import {Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import IdBadge from 'app/components/idBadge';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';
import SentryTypes from 'app/proptypes';
import TextLink from 'app/components/textLink';
import recreateRoute from 'app/utils/recreateRoute';
import withLatestContext from 'app/utils/withLatestContext';

class OrganizationCrumb extends React.Component {
  static propTypes = {
    organizations: PropTypes.array,
    organization: SentryTypes.Organization,
    routes: PropTypes.array,
    route: PropTypes.object,
  };

  render() {
    let {organizations, organization, params, routes, route, ...props} = this.props;

    if (!organization) return null;

    let hasMenu = organizations.length > 1;

    return (
      <BreadcrumbDropdown
        name={
          <TextLink
            to={recreateRoute(route, {
              routes,
              params: {...params, orgId: organization.slug},
            })}
          >
            <Flex align="center">
              <IdBadge avatarSize={18} organization={organization} />
            </Flex>
          </TextLink>
        }
        onSelect={item => {
          // If we are currently in a project context, and we're attempting to switch organizations,
          // then we need to default to index route (e.g. `route`)
          //
          // Otherwise, using empty string ('') will keep the current route path but with target org
          let hasProjectParam = !!params.projectId;
          let destination = hasProjectParam ? route : '';
          browserHistory.push(
            recreateRoute(destination, {
              routes,
              params: {...params, orgId: item.value},
            })
          );
        }}
        hasMenu={hasMenu}
        route={route}
        items={organizations.map(org => ({
          value: org.slug,
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
}

export {OrganizationCrumb};
export default withLatestContext(OrganizationCrumb);
