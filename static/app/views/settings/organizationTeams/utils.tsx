import {t} from 'sentry/locale';

export function getButtonHelpText(isIdpProvisioned = false) {
  if (isIdpProvisioned) {
    return t(
      "Membership to this team is managed through your organization's identity provider."
    );
  }

  return undefined;
}
