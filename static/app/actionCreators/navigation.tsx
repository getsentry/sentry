import type {Location, Query} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

// TODO(ts): figure out better typing for react-router here
export function navigateTo(
  to: string | {pathname: string; query?: Query},
  router: InjectedRouter & {location?: Location},
  configUrl?: string
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
            return window.setTimeout(() => router.push(normalizeUrl(path)), 0);
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
    router.push(normalizeUrl(typeof to === 'string' ? pathname : {...to, pathname}));
  }
}
