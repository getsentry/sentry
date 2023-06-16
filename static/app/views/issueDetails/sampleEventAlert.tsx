import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PageAlertBar from 'sentry/components/pageAlertBar';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AvatarProject, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

function SampleEventAlert({
  organization,
  project,
}: {
  organization: Organization;
  project: AvatarProject;
}) {
  return (
    <PageAlertBar>
      <IconLightning />
      <TextWrapper>
        {t(
          'You are viewing a sample error. Configure Sentry to start viewing real errors.'
        )}
      </TextWrapper>
      <Button
        size="xs"
        priority="primary"
        to={`/${organization.slug}/${project.slug}/getting-started/${
          project.platform || ''
        }`}
        onClick={() =>
          trackAnalytics('growth.sample_error_onboarding_link_clicked', {
            project_id: project.id?.toString(),
            organization,
            platform: project.platform,
          })
        }
      >
        {t('Get Started')}
      </Button>
    </PageAlertBar>
  );
}

export default SampleEventAlert;

const TextWrapper = styled('span')`
  margin: 0 ${space(1)};
`;
