import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PageAlertBar from 'sentry/components/pageAlertBar';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

export default function FinishSetupAlert({projectId}: {projectId: string}) {
  return (
    <PageAlertBar>
      <IconLightning />
      <TextWrapper>
        {t(
          'You are viewing a sample transaction. Configure performance to start viewing real transactions.'
        )}
      </TextWrapper>
      <Button
        size="xs"
        priority="primary"
        external
        href="https://docs.sentry.io/performance-monitoring/getting-started/"
        analyticsEventKey="growth.sample_transaction_docs_link_clicked"
        analyticsEventName="Growth: Sample Transaction Docs Link Clicked"
        analyticsParams={{project_id: projectId}}
      >
        {t('Get Started')}
      </Button>
    </PageAlertBar>
  );
}

const TextWrapper = styled('span')`
  margin: 0 ${space(1)};
`;
