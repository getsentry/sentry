import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Breadcrumbs, {Crumb, CrumbDropdown} from 'sentry/components/breadcrumbs';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import recreateRoute from 'sentry/utils/recreateRoute';
import withProjects from 'sentry/utils/withProjects';
import MenuItem from 'sentry/views/settings/components/settingsBreadcrumb/menuItem';
import {RouteWithName} from 'sentry/views/settings/components/settingsBreadcrumb/types';

type Props = {
  location: Location;
  orgSlug: string;
  projectSlug: string;
  projects: Project[];
  routes: RouteWithName[];
  title: string;
  alertName?: string;
  canChangeProject?: boolean;
};

function BuilderBreadCrumbs(props: Props) {
  const {
    orgSlug,
    title,
    alertName,
    projectSlug,
    projects,
    routes,
    canChangeProject,
    location,
  } = props;
  const project = projects.find(({slug}) => projectSlug === slug);
  const isSuperuser = isActiveSuperuser();

  const label = (
    <IdBadge project={project ?? {slug: projectSlug}} avatarSize={18} disableLink />
  );

  const projectCrumbLink = {
    to: `/organizations/${orgSlug}/alerts/rules/?project=${project?.id}`,
    label,
    preserveGlobalSelection: true,
  };
  const projectCrumbDropdown = {
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
  const projectCrumb = canChangeProject ? projectCrumbDropdown : projectCrumbLink;

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

export default withProjects(BuilderBreadCrumbs);
