import {useCallback} from 'react';
import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import ProjectsStore from 'sentry/stores/projectsStore';

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

  const onFinish = useCallback((modalProps: ModalRenderProps, path: string) => {
    return Promise.resolve(modalProps.closeModal()).then(() => {
      router.push(path);
    });
  }, []);

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
          onFinish={path => onFinish(modalProps, path)}
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
