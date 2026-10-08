import styled from '@emotion/styled';
import {IconSeer} from '@sentry/icons/iconSeer';

import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  getAutofixRunExists,
  isIssueQuickFixable,
} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeSeerLocation} from 'sentry/views/issueDetails/autofix/utils';

interface IssueSeerBadgeProps {
  group: Group;
}

export function IssueSeerBadge({group}: IssueSeerBadgeProps) {
  const organization = useOrganization();
  const location = useLocation();

  const autofixRunExists = getAutofixRunExists(group);
  const seerFixable = isIssueQuickFixable(group);
  const showSeer =
    areAiFeaturesAllowed(organization) && (autofixRunExists || seerFixable);

  let seerTitle = null;
  if (autofixRunExists && seerFixable) {
    seerTitle = t('Seer has a potential quick fix for this issue');
  } else if (autofixRunExists) {
    seerTitle = t('Seer has insight into this issue');
  } else if (seerFixable) {
    seerTitle = t('Seer thinks this issue might be quick to fix');
  }

  if (!showSeer) {
    return null;
  }

  return (
    <Tooltip title={seerTitle} skipWrapper>
      <SeerLink
        to={makeSeerLocation({organization, groupId: group.id, query: location.query})}
      >
        <IconSeer size="xs" />
        {seerFixable && <span>{t('Quick Fix')}</span>}
      </SeerLink>
    </Tooltip>
  );
}

const SeerLink = styled(Link)`
  display: inline-grid;
  gap: ${p => p.theme.space.xs};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.tokens.content.primary};
  position: relative;
`;
