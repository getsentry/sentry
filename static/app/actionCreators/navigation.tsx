import type {Location, Query} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import {ContextPickerModalContainer as ContextPickerModal} from 'sentry/components/contextPickerModal';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

export function navigateTo(
  to: string | {pathname: string; query?: Query},
  navigate: ReactRouter3Navigate,
  location: Location | undefined,
  configQueryKey?: ApiQueryKey
) {
  let pathname: string;
  if (typeof to === 'string') {
    pathname = to;
  } else {
    pathname = to.pathname;
  }
  // Check for placeholder params
  const needOrg = pathname.includes(':orgId');
  const needProject = pathname.includes(':projectId') || pathname.includes(':project');
  const needTeam = pathname.includes(':teamId');
  const comingFromProjectId = location?.query?.project;
  const needProjectId = !comingFromProjectId || Array.isArray(comingFromProjectId);

  const projectById = ProjectsStore.getById(
    typeof comingFromProjectId === 'string' ? comingFromProjectId : undefined
  );

  if (
    needOrg ||
    needTeam ||
    (needProject && (needProjectId || !projectById)) ||
    configQueryKey
  ) {
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={to}
          needOrg={needOrg}
          needProject={needProject}
          needTeam={needTeam}
          configQueryKey={configQueryKey}
          onFinish={path => {
            modalProps.closeModal();
            return window.setTimeout(() => navigate(normalizeUrl(path)), 0);
          }}
        />
      ),
      {}
    );
  } else {
    if (projectById) {
      pathname = replaceRouterParams(pathname, {
        projectId: projectById.slug,
        project: projectById.id,
      });
    }
    // Preserve query string
    navigate(normalizeUrl(typeof to === 'string' ? pathname : {...to, pathname}));
  }
}
