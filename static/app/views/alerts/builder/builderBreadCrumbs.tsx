import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Breadcrumbs, {Crumb, CrumbDropdown} from 'app/components/breadcrumbs';
import IdBadge from 'app/components/idBadge';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Project} from 'app/types';
import {isActiveSuperuser} from 'app/utils/isActiveSuperuser';
import recreateRoute from 'app/utils/recreateRoute';
import withProjects from 'app/utils/withProjects';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';
import {RouteWithName} from 'app/views/settings/components/settingsBreadcrumb/types';

type Props = {
  hasMetricAlerts: boolean;
  orgSlug: string;
  title: string;
  projectSlug: string;
  projects: Project[];
  routes: RouteWithName[];
  location: Location;
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

  const projectCrumbLink = {
    to: `/settings/${orgSlug}/projects/${projectSlug}/`,
    label: <IdBadge project={project} avatarSize={18} disableLink />,
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
    label: <IdBadge project={project} avatarSize={18} disableLink />,
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
      preserveGlobalSelection: true,
    },
    projectCrumb,
    {
      label: title,
      ...(alertName
        ? {
            to: `/organizations/${orgSlug}/alerts/${projectSlug}/wizard`,
            preserveGlobalSelection: true,
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
