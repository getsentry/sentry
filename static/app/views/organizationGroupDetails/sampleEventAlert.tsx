import styled from '@emotion/styled';

import Button from 'app/components/button';
import PageAlertBar from 'app/components/pageAlertBar';
import {IconLightning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Project} from 'app/types';
import trackAdvancedAnalyticsEvent from 'app/utils/analytics/trackAdvancedAnalyticsEvent';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

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
            project_id: '0',
            organization,
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
