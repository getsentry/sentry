import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import ProjectsStore from 'sentry/stores/projectsStore';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';

// TODO(ts): figure out better typing for react-router here
export function navigateTo(
  to: string,
  router: InjectedRouter & {location?: Location},
  configUrl?: string
) {
  // Check for placeholder params
  const needOrg = to.includes(':orgId');
  const needProject = to.includes(':projectId') || to.includes(':project');
  const comingFromProjectId = router?.location?.query?.project;
  const needProjectId = !comingFromProjectId || Array.isArray(comingFromProjectId);

  const projectById = ProjectsStore.getById(comingFromProjectId);

  if (needOrg || (needProject && (needProjectId || !projectById)) || configUrl) {
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={to}
          needOrg={needOrg}
          needProject={needProject}
          configUrl={configUrl}
          onFinish={path => {
            modalProps.closeModal();
            return window.setTimeout(() => router.push(path), 0);
          }}
        />
      ),
      {}
    );
  } else {
    if (projectById) {
      to = replaceRouterParams(to, {
        projectId: projectById.slug,
        project: projectById.id,
      });
    }
    router.push(to);
  }
}
