import {ConfigStore} from 'sentry/stores/configStore';
import {localizeDomain} from 'sentry/utils/resolveRoute';

/**
 * Where to create a new organization. With multi-region, organizations are
 * created on the main Sentry domain, outside of any organization's customer
 * domain, so the link is an absolute `href` instead of an in-app route.
 */
export function getCreateOrganizationLink(): {href: string} | {to: string} {
  return ConfigStore.get('features').has('system:multi-region')
    ? {href: `${localizeDomain(ConfigStore.get('links').sentryUrl)}/organizations/new/`}
    : {to: '/organizations/new/'};
}
