import {t} from 'sentry/locale';

export function getButtonHelpText(isIdpProvisioned: boolean, isPermissionGroup: boolean) {
  if (isIdpProvisioned) {
    return t(
      "Membership to this team is managed through your organization's identity provider."
    );
  }
  if (isPermissionGroup) {
    return t('Membership to a team with an organization role is managed by org owners.');
  }
  return undefined;
}
