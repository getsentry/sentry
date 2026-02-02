import {useEffect, useEffectEvent} from 'react';
import {Outlet, useOutletContext} from 'react-router-dom';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {navigateTo} from 'sentry/actionCreators/navigation';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import ProjectContext from 'sentry/views/projects/projectContext';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

type ProjectSettingsOutletContext = {
  project: Project;
};

function ProjectSettingsOutlet(props: ProjectSettingsOutletContext) {
  return <Outlet context={props} />;
}

export function useProjectSettingsOutlet() {
  return useOutletContext<ProjectSettingsOutletContext>();
}

function InnerProjectSettingsLayout({project}: {project: Project}) {
  // set analytics params for route based analytics
  useRouteAnalyticsParams({
    project_id: project.id,
    project_platform: project.platform,
  });

  return (
    <SettingsLayout>
      <ProjectSettingsOutlet project={project} />
    </SettingsLayout>
  );
}

export default function ProjectSettingsLayout() {
  const params = useParams<{projectId: string}>();
  const location = useLocation();
  const router = useRouter();

  const onMissingProject = useEffectEvent(() => {
    navigateTo(location.pathname, router);
  });

  useEffect(() => {
    if (params.projectId === ':projectId') {
      onMissingProject();
    }
  }, [params.projectId]);

  if (params.projectId === ':projectId') {
    return (
      <Flex justify="center" align="center" flex="1">
        <EmptyMessage
          icon={<IconProject size="xl" />}
          title={t('Choose a Project')}
          action={
            <Button
              priority="primary"
              onClick={() => navigateTo(location.pathname, router)}
            >
              {t('Choose Project')}
            </Button>
          }
        >
          {t('Select a project to continue.')}
        </EmptyMessage>
      </Flex>
    );
  }

  return (
    <ProjectContext projectSlug={params.projectId}>
      {({project}) => <InnerProjectSettingsLayout project={project} />}
    </ProjectContext>
  );
}
