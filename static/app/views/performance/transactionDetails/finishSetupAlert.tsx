import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PageAlertBar from 'sentry/components/pageAlertBar';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

export default function FinishSetupAlert({
  organization,
  projectId,
}: {
  organization: Organization;
  projectId: string;
}) {
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
        onClick={() =>
          trackAnalytics('growth.sample_transaction_docs_link_clicked', {
            project_id: projectId,
            organization,
          })
        }
      >
        {t('Get Started')}
      </Button>
    </PageAlertBar>
  );
}

const TextWrapper = styled('span')`
  margin: 0 ${space(1)};
`;
