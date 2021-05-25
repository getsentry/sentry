import {InjectedRouter} from 'react-router/lib/Router';
import {Location} from 'history';

import {openModal} from 'app/actionCreators/modal';
import NavigationActions from 'app/actions/navigationActions';
import ContextPickerModal from 'app/components/contextPickerModal';
import ProjectsStore from 'app/stores/projectsStore';

// TODO(ts): figure out better typing for react-router here
export function navigateTo(
  to: string,
  router: InjectedRouter & {location?: Location},
  configUrl?: string
) {
  // Check for placeholder params
  const needOrg = to.indexOf(':orgId') > -1;
  const needProject = to.indexOf(':projectId') > -1;
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
          comingFromProjectId={
            Array.isArray(comingFromProjectId) ? '' : comingFromProjectId || ''
          }
          onFinish={path => {
            modalProps.closeModal();
            setTimeout(() => router.push(path), 0);
          }}
        />
      ),
      {}
    );
  } else {
    projectById
      ? router.push(to.replace(':projectId', projectById.slug))
      : router.push(to);
  }
}

export function setLastRoute(route: string) {
  NavigationActions.setLastRoute(route);
}
