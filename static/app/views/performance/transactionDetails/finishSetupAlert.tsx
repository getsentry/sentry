import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import PageAlertBar from 'sentry/components/pageAlertBar';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

export default function FinishSetupAlert({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
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
        size="xsmall"
        priority="primary"
        target="_blank"
        external
        href="https://docs.sentry.io/performance-monitoring/getting-started/"
        onClick={() =>
          trackAdvancedAnalyticsEvent('growth.sample_transaction_docs_link_clicked', {
            project_id: project.id,
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
