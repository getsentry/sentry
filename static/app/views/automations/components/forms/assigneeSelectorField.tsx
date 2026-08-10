import styled from '@emotion/styled';

import {SentryMemberTeamSelectorField} from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import {t} from 'sentry/locale';

/**
 * The assignee is purely an organizational tool — it has no effect on when the
 * alert fires or who it notifies.
 */
export function AssigneeSelectorField() {
  return (
    <EmbeddedMemberTeamSelectorField
      name="owner"
      label={t('Assign')}
      placeholder={t('Select a member or team')}
      help={t(
        "Make it easier to search through your organization's alerts by assigning a user or team. This has no effect on when the alert fires or who it notifies."
      )}
      inline={false}
      flexibleControlStateSize
    />
  );
}

const EmbeddedMemberTeamSelectorField = styled(SentryMemberTeamSelectorField)`
  padding: 0;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  text-transform: none;
`;
