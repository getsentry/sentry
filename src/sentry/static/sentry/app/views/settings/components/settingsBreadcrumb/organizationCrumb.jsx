import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import BreadcrumbDropdown from './breadcrumbDropdown';
import LetterAvatar from '../../../../components/letterAvatar';
import MenuItem from './menuItem';
import SentryTypes from '../../../../proptypes';
import TextLink from '../../../../components/textLink';
import {Flex} from '../../../../components/grid';
import recreateRoute from '../../../../utils/recreateRoute';
import withLatestContext from '../../../../utils/withLatestContext';

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
              <span style={{width: 18, height: 18, marginRight: 6}}>
                <LetterAvatar
                  style={{display: 'inline-block'}}
                  displayName={organization.slug}
                  identifier={organization.slug}
                />
              </span>
              {organization.slug}
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
          label: <MenuItem>{org.slug}</MenuItem>,
        }))}
        {...props}
      />
    );
  }
}

export {OrganizationCrumb};
export default withLatestContext(OrganizationCrumb);
