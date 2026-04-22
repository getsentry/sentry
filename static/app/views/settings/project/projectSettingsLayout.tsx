import {useEffect, useEffectEvent} from 'react';
import {Outlet, useOutletContext} from 'react-router-dom';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import ProjectContext from 'sentry/views/projects/projectContext';
import {SettingsLayout} from 'sentry/views/settings/components/settingsLayout';
import {ProjectSettingsCommandPaletteActions} from 'sentry/views/settings/project/projectSettingsCommandPaletteActions';

type ProjectSettingsOutletContext = {
  project: Project;
};

function ProjectSettingsOutlet(props: ProjectSettingsOutletContext) {
  return <Outlet context={props} />;
}

export function useProjectSettingsOutlet() {
  return useOutletContext<ProjectSettingsOutletContext>();
}

function InnerProjectSettingsLayout({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}) {
  // set analytics params for route based analytics
  useRouteAnalyticsParams({
    project_id: project.id,
    project_platform: project.platform,
  });

  return (
    <SettingsLayout>
      <ProjectSettingsCommandPaletteActions
        organization={organization}
        project={project}
      />
      <ProjectSettingsOutlet project={project} />
    </SettingsLayout>
  );
}

export default function ProjectSettingsLayout() {
  const organization = useOrganization();
  const params = useParams<{projectId: string}>();
  const location = useLocation();
  const navigate = useNavigate();

  const onMissingProject = useEffectEvent(() => {
    navigateTo(location.pathname, navigate, location);
  });

  useEffect(() => {
    if (params.projectId === ':projectId') {
      onMissingProject();
    }
  }, [params.projectId]);

  if (params.projectId === ':projectId') {
    return (
      <AnalyticsArea name="project">
        <Flex justify="center" align="center" flex="1">
          <EmptyMessage
            icon={<IconProject size="xl" />}
            title={t('Choose a Project')}
            action={
              <Button
                priority="primary"
                onClick={() => navigateTo(location.pathname, navigate, location)}
              >
                {t('Choose Project')}
              </Button>
            }
          >
            {t('Select a project to continue.')}
          </EmptyMessage>
        </Flex>
      </AnalyticsArea>
    );
  }

  return (
    <AnalyticsArea name="project">
      <ProjectContext projectSlug={params.projectId}>
        {({project}) => (
          <InnerProjectSettingsLayout organization={organization} project={project} />
        )}
      </ProjectContext>
    </AnalyticsArea>
  );
}
