import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import PageAlertBar from 'sentry/components/pageAlertBar';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {GlobalSelection, Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

function SampleEventAlert({
  selection,
  organization,
  projects,
}: {
  selection: GlobalSelection;
  organization: Organization;
  projects: Project[];
}) {
  if (projects.length === 0) {
    return null;
  }
  if (selection.projects.length !== 1) {
    return null;
  }
  const selectedProject = projects.find(p => p.id === selection.projects[0].toString());
  if (!selectedProject || selectedProject.firstEvent) {
    return null;
  }
  return (
    <PageAlertBar>
      <IconLightning />
      <TextWrapper>
        {t(
          'You are viewing a sample error. Configure Sentry to start viewing real errors.'
        )}
      </TextWrapper>
      <Button
        size="xsmall"
        priority="primary"
        to={`/${organization.slug}/${selectedProject.slug}/getting-started/${
          selectedProject.platform || ''
        }`}
        onClick={() =>
          trackAdvancedAnalyticsEvent('growth.sample_error_onboarding_link_clicked', {
            project_id: selectedProject.id,
            organization,
            platform: selectedProject.platform,
          })
        }
      >
        {t('Get Started')}
      </Button>
    </PageAlertBar>
  );
}

export default withProjects(withOrganization(withGlobalSelection(SampleEventAlert)));

const TextWrapper = styled('span')`
  margin: 0 ${space(1)};
`;
