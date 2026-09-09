import { Response } from "express";
import mongoose from "mongoose";

import User from "../models/User";
import Project from "../models/Project";
import Task from "../models/Task";
import LeaveRequest from "../models/LeaveRequest";
import Department from "../models/Department";
import { AuthRequest } from "../middleware/authMiddleware";

// =====================================================
// EMPLOYEE REPORT
// =====================================================

export const getEmployeeReport = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { department, status, search } = req.query;
    const userFilter: Record<string, any> = {};

    if (department && department !== "all" && mongoose.Types.ObjectId.isValid(String(department))) {
      userFilter.department = department;
    }
    if (status && status !== "all") {
      userFilter.isActive = status === "active";
    }
    if (search) {
      userFilter.$or = [
        { name: { $regex: String(search), $options: "i" } },
        { email: { $regex: String(search), $options: "i" } },
        { employeeId: { $regex: String(search), $options: "i" } },
      ];
    }

    const [employees, allProjects, allTasks, allLeaves] = await Promise.all([
      User.find(userFilter).populate("department", "name"),
      Project.find(),
      Task.find(),
      LeaveRequest.find({ status: "APPROVED" }),
    ]);

    const reportRows = employees.map((emp: any) => {
      const empProjects = allProjects.filter((p) =>
        p.employees.some((eId) => String(eId) === String(emp._id))
      );
      const empTasks = allTasks.filter((t) =>
        t.assignedTo.some((aId) => String(aId) === String(emp._id))
      );
      const activeTasks = empTasks.filter((t) => t.status !== "DONE").length;
      const completedTasks = empTasks.filter((t) => t.status === "DONE").length;

      const empLeaves = allLeaves.filter(
        (l) => String(l.employee) === String(emp._id)
      );
      const leavesTaken = empLeaves.reduce((sum, l) => sum + (l.days || 0), 0);

      return {
        id: String(emp._id),
        employeeId: emp.employeeId || "EMP-000",
        name: emp.name,
        email: emp.email,
        department: emp.department?.name || "Unassigned",
        designation: emp.designation || "Staff",
        assignedProjects: empProjects.length,
        activeTasks,
        completedTasks,
        leavesTaken,
        status: emp.isActive ? "active" : "inactive",
      };
    });

    res.status(200).json({
      success: true,
      data: reportRows,
    });
  } catch (error: any) {
    console.error("Employee Report Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to generate employee report",
    });
  }
};

// =====================================================
// PROJECT REPORT
// =====================================================

export const getProjectReport = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { department, status, search } = req.query;
    const filter: Record<string, any> = {};

    if (department && department !== "all" && mongoose.Types.ObjectId.isValid(String(department))) {
      filter.department = department;
    }
    if (status && status !== "all") {
      filter.status = String(status).toUpperCase();
    }
    if (search) {
      filter.name = { $regex: String(search), $options: "i" };
    }

    const [projects, allTasks] = await Promise.all([
      Project.find(filter)
        .populate("department", "name")
        .populate("projectManager", "name email"),
      Task.find(),
    ]);

    const reportRows = projects.map((p: any) => {
      const pTasks = allTasks.filter(
        (t: any) => String(t.project?._id || t.project) === String(p._id)
      );
      const completedTasks = pTasks.filter((t) => t.status === "DONE").length;
      const progress = pTasks.length > 0 ? Math.round((completedTasks / pTasks.length) * 100) : 0;

      return {
        id: String(p._id),
        projectCode: p.name.substring(0, 3).toUpperCase() + "-" + String(p._id).slice(-3),
        name: p.name,
        department: p.department?.name || "Unassigned",
        projectManager: p.projectManager?.name || "Unassigned",
        teamSize: (p.employees || []).length,
        totalTasks: pTasks.length,
        completedTasks,
        progress,
        status: String(p.status).toLowerCase(),
        priority: String(p.priority).toLowerCase(),
        deadline: p.endDate ? new Date(p.endDate).toISOString().split("T")[0] : "None",
      };
    });

    res.status(200).json({
      success: true,
      data: reportRows,
    });
  } catch (error: any) {
    console.error("Project Report Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to generate project report",
    });
  }
};

// =====================================================
// TASK REPORT
// =====================================================

export const getTaskReport = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, priority, search } = req.query;
    const filter: Record<string, any> = {};

    if (status && status !== "all") {
      filter.status = String(status).toUpperCase();
    }
    if (priority && priority !== "all") {
      filter.priority = String(priority).toUpperCase();
    }
    if (search) {
      filter.$or = [
        { title: { $regex: String(search), $options: "i" } },
        { taskCode: { $regex: String(search), $options: "i" } },
      ];
    }

    const tasks = await Task.find(filter)
      .populate("project", "name code")
      .populate("assignedTo", "name employeeId");

    const reportRows = tasks.map((t: any) => ({
      id: String(t._id),
      taskCode: t.taskCode,
      title: t.title,
      projectName: t.project?.name || "Project",
      assignees: (t.assignedTo || []).map((a: any) => a.name).join(", ") || "Unassigned",
      priority: String(t.priority).toLowerCase(),
      status: String(t.status).toLowerCase(),
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "None",
      progress: t.progress || 0,
      blockersCount: (t.blockers || []).length,
    }));

    res.status(200).json({
      success: true,
      data: reportRows,
    });
  } catch (error: any) {
    console.error("Task Report Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to generate task report",
    });
  }
};

// =====================================================
// DEPARTMENT WORKLOAD REPORT
// =====================================================

export const getWorkloadReport = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const [departments, allUsers, allProjects, allTasks] = await Promise.all([
      Department.find({ isActive: true }),
      User.find({ isActive: true }),
      Project.find({ status: "IN_PROGRESS" }),
      Task.find({ status: { $ne: "DONE" } }),
    ]);

    const reportRows = departments.map((d) => {
      const deptEmps = allUsers.filter(
        (u) => String(u.department) === String(d._id)
      );
      const deptProjects = allProjects.filter(
        (p) => String(p.department) === String(d._id)
      );
      const deptTasks = allTasks.filter((t: any) => {
        const p = deptProjects.find(
          (prj) => String(prj._id) === String(t.project?._id || t.project)
        );
        return Boolean(p);
      });

      const estimatedHours = deptTasks.reduce(
        (sum, t) => sum + (t.estimatedHours || 8),
        0
      );
      const capacityHours = Math.max(deptEmps.length * 40, 40);
      const utilizationRate = Math.min(
        Math.round((estimatedHours / capacityHours) * 100),
        150
      );

      return {
        id: String(d._id),
        department: d.name,
        headCount: deptEmps.length,
        activeProjects: deptProjects.length,
        activeTasks: deptTasks.length,
        estimatedHours,
        utilizationRate,
      };
    });

    res.status(200).json({
      success: true,
      data: reportRows,
    });
  } catch (error: any) {
    console.error("Workload Report Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to generate workload report",
    });
  }
};

// =====================================================
// HELPER TO GENERATE VALID PDF BINARY
// =====================================================

function generatePdfReport(title: string, headers: string[], rows: string[][]): Buffer {
  const lines: string[] = [];
  lines.push(`EMS-PMS EXECUTIVE REPORT: ${title.toUpperCase()}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("=".repeat(75));
  lines.push(headers.join("  |  "));
  lines.push("-".repeat(75));
  rows.forEach((r) => lines.push(r.join("  |  ")));
  lines.push("=".repeat(75));
  lines.push("Confidential - EMS-PMS Portal System");

  // Construct PDF stream content
  const pdfStream =
    `BT /F1 9 Tf 30 750 Td 14 TL\n` +
    lines
      .map(
        (line) =>
          `(${line
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")}) '`
      )
      .join("\n") +
    `\nET`;

  const pdfObj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pdfObj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  const pdfObj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`;
  const pdfObj4 = `4 0 obj\n<< /Length ${Buffer.byteLength(pdfStream)} >>\nstream\n${pdfStream}\nendstream\nendobj\n`;
  const pdfObj5 = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`;

  const header = `%PDF-1.4\n`;
  let body = header;
  const offsets: number[] = [];

  offsets.push(Buffer.byteLength(body));
  body += pdfObj1;
  offsets.push(Buffer.byteLength(body));
  body += pdfObj2;
  offsets.push(Buffer.byteLength(body));
  body += pdfObj3;
  offsets.push(Buffer.byteLength(body));
  body += pdfObj4;
  offsets.push(Buffer.byteLength(body));
  body += pdfObj5;

  const xrefOffset = Buffer.byteLength(body);
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xref += String(off).padStart(10, "0") + ` 00000 n \n`;
  });

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, "utf-8");
}

// =====================================================
// EXPORT REPORT CSV / PDF
// =====================================================

export const exportReport = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { category = "employees", format = "csv" } = req.body;

    let headers: string[] = [];
    let tableRows: string[][] = [];
    let title = category;

    if (category === "employees" || category === "workforce") {
      title = "Workforce Performance";
      headers = ["Emp ID", "Name", "Email", "Department", "Designation", "Status"];
      const employees = await User.find().populate("department", "name");
      tableRows = employees.map((e: any) => [
        e.employeeId || "N/A",
        e.name,
        e.email,
        e.department?.name || "Unassigned",
        e.designation || "Staff",
        e.isActive ? "Active" : "Inactive",
      ]);
    } else if (category === "projects") {
      title = "Project Portfolio";
      headers = ["Code", "Name", "Department", "Manager", "Status", "Priority"];
      const projects = await Project.find().populate("department", "name").populate("projectManager", "name");
      tableRows = projects.map((p: any) => [
        p.name.substring(0, 3).toUpperCase(),
        p.name,
        p.department?.name || "Unassigned",
        p.projectManager?.name || "Unassigned",
        p.status,
        p.priority,
      ]);
    } else if (category === "tasks") {
      title = "Task Execution";
      headers = ["Task Code", "Title", "Project", "Priority", "Status", "Progress"];
      const tasks = await Task.find().populate("project", "name");
      tableRows = tasks.map((t: any) => [
        t.taskCode,
        t.title,
        t.project?.name || "N/A",
        t.priority,
        t.status,
        `${t.progress}%`,
      ]);
    } else if (category === "leaves" || category === "workload") {
      title = "Leave & Workload";
      headers = ["Employee", "ID", "Leave Type", "Start Date", "End Date", "Status"];
      const leaves = await LeaveRequest.find().populate("employee", "name employeeId");
      tableRows = leaves.map((l: any) => [
        l.employee?.name || "N/A",
        l.employee?.employeeId || "N/A",
        l.leaveType,
        new Date(l.startDate).toLocaleDateString(),
        new Date(l.endDate).toLocaleDateString(),
        l.status,
      ]);
    }

    if (format === "pdf") {
      const pdfBuffer = generatePdfReport(title, headers, tableRows);
      const filename = `ems-report-${category}-${new Date().toISOString().split("T")[0]}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(pdfBuffer);
      return;
    }

    // Default CSV format
    let csvContent = headers.join(",") + "\n";
    tableRows.forEach((r) => {
      csvContent += r.map((val) => `"${val.replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const filename = `ems-report-${category}-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error("Export Report Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to export report",
    });
  }
};

