import {useUser} from 'sentry/utils/useUser';

/**
 * Hook to check if the current user is a Sentry employee.
 * It uses the user's emails to determine if at least one email is verified
 * and ends with the sentry.io domain, which would indicate they are an employee.
 *
 * @return {boolean} - Returns true if the user is a Sentry employee, otherwise false.
 */
export function useIsSentryEmployee(): boolean {
  const {emails} = useUser();

  return emails.some(
    // TODO: In the near future isStaff should actually mean is a Sentry employee, right now it doesn't.
    ({email, is_verified}) => email.endsWith('@sentry.io') && is_verified
  );
}
