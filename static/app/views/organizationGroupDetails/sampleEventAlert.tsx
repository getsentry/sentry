import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PageAlertBar from 'sentry/components/pageAlertBar';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AvatarProject, Organization} from 'sentry/types';

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
        analyticsEventKey="growth.sample_error_onboarding_link_clicked"
        analyticsEventName="Growth: Sample Error Onboarding Link Clicked"
        analyticsParams={{project_id: project.id?.toString(), platform: project.platform}}
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
