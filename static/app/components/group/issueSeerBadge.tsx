import styled from '@emotion/styled';

import {SeerIcon} from 'sentry/components/ai/SeerIcon';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  getAutofixRunExists,
  isIssueQuickFixable,
} from 'sentry/components/events/autofix/utils';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';

interface IssueSeerBadgeProps {
  group: Group;
}

function IssueSeerBadge({group}: IssueSeerBadgeProps) {
  const organization = useOrganization();
  const issuesPath = `/organizations/${organization.slug}/issues/`;

  const autofixRunExists = getAutofixRunExists(group);
  const seerFixable = isIssueQuickFixable(group);
  const showSeer =
    organization.features.includes('gen-ai-features') &&
    !organization.hideAiFeatures &&
    (autofixRunExists || seerFixable);

  let seerTitle = null;
  if (autofixRunExists && seerFixable) {
    seerTitle = 'Seer has a potential quick fix for this issue';
  } else if (autofixRunExists) {
    seerTitle = 'Seer has insight into this issue';
  } else if (seerFixable) {
    seerTitle = 'This issue might be quick to fix';
  }

  if (!showSeer) {
    return null;
  }

  return (
    <Tooltip title={seerTitle} skipWrapper>
      <SeerLink to={{pathname: `${issuesPath}${group.id}`, query: {seerDrawer: true}}}>
        <SeerIcon size="sm" />
        {seerFixable && <p>Quick Fix</p>}
      </SeerLink>
    </Tooltip>
  );
}

const SeerLink = styled(Link)`
  display: inline-grid;
  gap: ${space(0.5)};
  align-items: center;
  grid-auto-flow: column;
  color: ${p => p.theme.textColor};
  position: relative;
`;

export default IssueSeerBadge;
