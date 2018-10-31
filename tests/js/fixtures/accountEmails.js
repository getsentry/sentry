export function AccountEmails(params = []) {
  return [
    {
      email: 'primary@example.com',
      isPrimary: true,
      isVerified: true,
    },
    {
      email: 'secondary1@example.com',
      isPrimary: false,
      isVerified: true,
    },
    {
      email: 'secondary2@example.com',
      isPrimary: false,
      isVerified: false,
    },
    ...params,
  ];
}
