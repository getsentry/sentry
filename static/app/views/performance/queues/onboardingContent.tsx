import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function OnboardingContent() {
  return (
    <Fragment>
      <Header>{t('Start collecting Insights about your Queues!')}</Header>
      <p>
        {t('Our robot is waiting for your first background job to complete.')}{' '}
        <ExternalLink href="https://develop.sentry.dev/sdk/performance/modules/queues/">
          {t('Learn more')}
        </ExternalLink>
      </p>
    </Fragment>
  );
}

const Header = styled('h3')`
  margin-bottom: ${space(1)};
`;
