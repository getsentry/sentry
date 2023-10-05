import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import IdBadge from 'sentry/components/idBadge';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Organization} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import {resolveRoute} from 'sentry/utils/resolveRoute';
import useOrganization from 'sentry/utils/useOrganization';
import BreadcrumbDropdown from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import findFirstRouteWithoutRouteParam from 'sentry/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam';
import MenuItem from 'sentry/views/settings/components/settingsBreadcrumb/menuItem';

import {CrumbLink} from '.';

type Props = RouteComponentProps<{projectId?: string}, {}>;

function OrganizationCrumb({params, routes, route, ...props}: Props) {
  const organizations = useLegacyStore(OrganizationsStore);
  const organization = useOrganization();

  const handleSelect = (item: {value: Organization}) => {
    // If we are currently in a project context, and we're attempting to switch organizations,
    // then we need to default to index route (e.g. `route`)
    //
    // Otherwise, find the last route without a router param
    // e.g. if you are on API details, we want the API listing
    // This fails if our route tree is not nested
    const hasProjectParam = !!params.projectId;
    let destinationRoute = hasProjectParam
      ? route
      : findFirstRouteWithoutRouteParam(routes.slice(routes.indexOf(route)));

    // It's possible there is no route without route params (e.g. organization settings index),
    // in which case, we can use the org settings index route (e.g. `route`)
    if (!hasProjectParam && typeof destinationRoute === 'undefined') {
      destinationRoute = route;
    }

    if (destinationRoute === undefined) {
      return;
    }
    const itemOrg = item.value;
    const path = recreateRoute(destinationRoute, {
      routes,
      params: {...params, orgId: itemOrg.slug},
    });
    const resolvedUrl = resolveRoute(path, organization, itemOrg);
    // If we have a shift in domains, we can't use history
    if (resolvedUrl.startsWith('http')) {
      window.location.assign(resolvedUrl);
    } else {
      browserHistory.push(resolvedUrl);
    }
  };

  if (!organization) {
    return null;
  }

  const hasMenu = organizations.length > 1;
  const orgSettings = `/settings/${organization.slug}/`;

  return (
    <BreadcrumbDropdown
      name={
        <CrumbLink to={orgSettings}>
          <BadgeWrapper>
            <IdBadge avatarSize={18} organization={organization} />
          </BadgeWrapper>
        </CrumbLink>
      }
      onSelect={handleSelect}
      hasMenu={hasMenu}
      route={route}
      items={organizations.map((org, index) => ({
        index,
        value: org,
        label: (
          <MenuItem>
            <IdBadge organization={org} />
          </MenuItem>
        ),
      }))}
      {...props}
    />
  );
}

const BadgeWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

export {OrganizationCrumb};
