import type {Scope} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

interface UseAccessProps {
  /**
   * List of required access levels
   */
  access: Scope[];
  /**
   * Should the component require all access levels or just one or more
   * @default true
   */
  requireAll?: boolean;
}

/**
 * Check that the current user has access to the given scopes
 *
 * example use:
 * ```tsx
 * const hasAccess = useAccess({access: ['project:write']});
 * ```
 */
export function useAccess({access, requireAll = true}: UseAccessProps) {
  const organization = useOrganization();

  const method = requireAll ? 'every' : 'some';
  return !access || access[method](acc => organization.access.includes(acc));
}
