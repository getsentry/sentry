import styled from '@emotion/styled';

import {SeerIcon} from 'sentry/components/ai/SeerIcon';
import {Tooltip} from 'sentry/components/core/tooltip';
import {isIssueQuickFixable} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import {Divider} from 'sentry/views/issueDetails/divider';

function SeerBadge({group}: {group: Group}) {
  const organization = useOrganization();
  const seerFixable = isIssueQuickFixable(group);

  if (
    !organization.features.includes('gen-ai-features') ||
    organization.hideAiFeatures ||
    !seerFixable
  ) {
    return null;
  }

  return (
    <Tooltip title={t('Seer thinks this issue might be quick to fix')} skipWrapper>
      <Wrapper>
        <Divider />
        <SeerIcon size="sm" />
        {seerFixable && <span>{t('Quick Fix')}</span>}
      </Wrapper>
    </Tooltip>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
`;

export default SeerBadge;
