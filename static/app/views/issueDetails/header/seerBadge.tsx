import {Fragment} from 'react';

import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';

import {isIssueQuickFixable} from 'sentry/components/events/autofix/utils';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Divider} from 'sentry/views/issueDetails/divider';

export function SeerBadge({group}: {group: Group}) {
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
    <Fragment>
      <Divider />
      <InfoText title={t('Seer thinks this issue might be quick to fix')} variant="muted">
        <Flex align="center" gap="xs">
          <IconSeer size="sm" />
          {seerFixable && <span>{t('Quick Fix')}</span>}
        </Flex>
      </InfoText>
    </Fragment>
  );
}
