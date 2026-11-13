import type {Location, Query} from 'history';

import {openModal} from '@sentry/scraps/modal';

import {ContextPickerModalContainer as ContextPickerModal} from 'sentry/components/contextPickerModal';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {loadQueryParamsFromLocation} from 'sentry/views/explore/queryParams/parsers';

export function navigateTo(
  to: string | {pathname: string; query?: Query},
  navigate: ReactRouter3Navigate,
  location: Location | undefined
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
  const projectIds = location
    ? loadQueryParamsFromLocation(pageFilterParsers, location).project
    : [];
  const [projectId] = projectIds;
  const projectById =
    projectIds.length === 1 && projectId ? ProjectsStore.getById(projectId) : undefined;

  if (needOrg || needTeam || (needProject && !projectById)) {
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={to}
          needOrg={needOrg}
          needProject={needProject}
          needTeam={needTeam}
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
