// =====================================================
// GENERATE TEMPORARY PASSWORD
// =====================================================

export const generateTemporaryPassword = (
  length: number = 10
): string => {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$";

  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(
      Math.random() * characters.length
    );

    password += characters[randomIndex];
  }

  return password;
};