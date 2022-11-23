import {useCallback} from 'react';

import {openModal} from 'sentry/actionCreators/modal';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import ProjectsStore from 'sentry/stores/projectsStore';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

// TODO(ts): figure out better typing for react-router here
export function useNavigationControl() {
  // Check for placeholder params
  const location = useLocation<{project: string}>();
  const navigate = useNavigate();

  const navigateTo = useCallback(
    (to: string, configUrl?: string) => {
      const needOrg = to.includes(':orgId');
      const needProject = to.includes(':projectId') || to.includes(':project');

      const comingFromProjectId = location?.query?.project;
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
                return window.setTimeout(() => navigate(path), 0);
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
        navigate(normalizeUrl(to));
      }
    },
    [navigate, location]
  );
  return navigateTo;
}
