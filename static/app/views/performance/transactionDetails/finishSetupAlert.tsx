import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconLightning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';

export default function FinishSetupAlert({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}) {
  return (
    <AlertBar>
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
          trackAdvancedAnalyticsEvent(
            'growth.sample_transaction_docs_link_clicked',
            {
              project_id: project.id,
            },
            organization
          )
        }
      >
        {t('Get Started')}
      </Button>
    </AlertBar>
  );
}

const AlertBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.headerBackground};
  background-color: ${p => p.theme.bannerBackground};
  padding: 6px 30px;
  font-size: 14px;
`;

const TextWrapper = styled('span')`
  margin: 0 ${space(1)};
`;
