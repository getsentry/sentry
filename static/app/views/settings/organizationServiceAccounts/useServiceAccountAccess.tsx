import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';

/**
 * Prototype only. Pick who you're viewing as with `?as=owner|admin|member`. The choice
 * sticks for the browser tab, so it survives navigating between pages.
 *
 * - `owner`: `service_account:write` and a global role (Manager or Owner). The default.
 * - `admin`: `service_account:write` without a global role.
 * - `member`: `service_account:read` only.
 */
type ViewerRole = 'owner' | 'admin' | 'member';

const STORAGE_KEY = 'service-accounts-prototype:as';
const ROLES: ViewerRole[] = ['owner', 'admin', 'member'];

function isViewerRole(value: unknown): value is ViewerRole {
  return ROLES.includes(value as ViewerRole);
}

export function useServiceAccountAccess() {
  const location = useLocation();
  const fromUrl = location.query.as;
  if (isViewerRole(fromUrl)) {
    sessionStorage.setItem(STORAGE_KEY, fromUrl);
  }
  const stored = sessionStorage.getItem(STORAGE_KEY);
  const role: ViewerRole = isViewerRole(stored) ? stored : 'owner';

  return {
    canWrite: role !== 'member',
    hasGlobalRole: role === 'owner',
    noWriteReason: t('You need the Manager or Owner role to manage service accounts.'),
    noCreateReason: t('You need the Manager or Owner role to create service accounts.'),
  };
}
