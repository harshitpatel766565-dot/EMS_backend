import User from "../models/User";

// =====================================================
// GENERATE UNIQUE EMPLOYEE ID
// =====================================================

export const generateEmployeeId = async (): Promise<string> => {
  let employeeId = "";
  let exists = true;

  while (exists) {
    const randomNumber = Math.floor(
      1000 + Math.random() * 9000
    );

    employeeId = `EMP-${randomNumber}`;

    const existingEmployee = await User.findOne({
      employeeId,
    });

    exists = !!existingEmployee;
  }

  return employeeId;
};