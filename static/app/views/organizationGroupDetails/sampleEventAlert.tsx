import styled from '@emotion/styled';

import AlertBar from 'app/components/alertBar';
import Button from 'app/components/button';
import {IconLightning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import trackAdvancedAnalyticsEvent from 'app/utils/analytics/trackAdvancedAnalyticsEvent';

export default function SampleEventAlert({
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
          'You are viewing a sample error. Configure Sentry to start viewing real errors.'
        )}
      </TextWrapper>
      <Button
        size="xsmall"
        priority="primary"
        to={`/${organization.slug}/${project.slug}/getting-started/${
          project.platform || ''
        }`}
        onClick={() =>
          trackAdvancedAnalyticsEvent('growth.sample_transaction_docs_link_clicked', {
            project_id: '0',
            organization,
          })
        }
      >
        {t('Get Started')}
      </Button>
    </AlertBar>
  );
}

const TextWrapper = styled('span')`
  margin: 0 ${space(1)};
`;
