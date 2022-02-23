import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Breadcrumbs, {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import recreateRoute from 'sentry/utils/recreateRoute';
import useProjects from 'sentry/utils/useProjects';
import MenuItem from 'sentry/views/settings/components/settingsBreadcrumb/menuItem';
import type {RouteWithName} from 'sentry/views/settings/components/settingsBreadcrumb/types';

interface Props {
  location: Location;
  orgSlug: string;
  projectSlug: string;
  routes: RouteWithName[];
  title: string;
  alertName?: string;
  canChangeProject?: boolean;
}

function BuilderBreadCrumbs({
  orgSlug,
  title,
  alertName,
  projectSlug,
  routes,
  canChangeProject,
  location,
}: Props) {
  const {projects} = useProjects();
  const isSuperuser = isActiveSuperuser();
  const project = projects.find(({slug}) => projectSlug === slug);

  const label = (
    <IdBadge project={project ?? {slug: projectSlug}} avatarSize={18} disableLink />
  );

  const projectCrumbLink: Crumb = {
    to: `/organizations/${orgSlug}/alerts/rules/?project=${project?.id}`,
    label,
  };

  function getProjectDropdownCrumb(): CrumbDropdown {
    return {
      onSelect: ({value}) => {
        browserHistory.push(
          recreateRoute('', {
            routes,
            params: {orgId: orgSlug, projectId: value},
            location,
          })
        );
      },
      label,
      items: projects
        .filter(proj => proj.isMember || isSuperuser)
        .map((proj, index) => ({
          index,
          value: proj.slug,
          label: (
            <MenuItem>
              <IdBadge
                project={proj}
                avatarProps={{consistentWidth: true}}
                avatarSize={18}
                disableLink
              />
            </MenuItem>
          ),
          searchKey: proj.slug,
        })),
    };
  }

  const projectCrumb = canChangeProject ? getProjectDropdownCrumb() : projectCrumbLink;

  const crumbs: (Crumb | CrumbDropdown)[] = [
    {
      to: `/organizations/${orgSlug}/alerts/rules/`,
      label: t('Alerts'),
      preservePageFilters: true,
    },
    projectCrumb,
    {
      label: title,
      ...(alertName
        ? {
            to: `/organizations/${orgSlug}/alerts/${projectSlug}/wizard`,
            preservePageFilters: true,
          }
        : {}),
    },
  ];
  if (alertName) {
    crumbs.push({label: alertName});
  }

  return <StyledBreadcrumbs crumbs={crumbs} />;
}

const StyledBreadcrumbs = styled(Breadcrumbs)`
  font-size: 18px;
  margin-bottom: ${space(3)};
`;

export default BuilderBreadCrumbs;
