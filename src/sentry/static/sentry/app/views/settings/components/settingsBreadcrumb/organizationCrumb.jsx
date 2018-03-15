import {Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import BreadcrumbDropdown from './breadcrumbDropdown';
import LetterAvatar from '../../../../components/letterAvatar';
import SentryTypes from '../../../../proptypes';
import TextLink from '../../../../components/textLink';
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
          browserHistory.push(
            recreateRoute(route, {
              routes,
              params: {...params, orgId: item.value},
            })
          );
        }}
        hasMenu={hasMenu}
        route={route}
        items={organizations.map(org => ({
          value: org.slug,
          label: org.slug,
        }))}
        {...props}
      />
    );
  }
}

export {OrganizationCrumb};
export default withLatestContext(OrganizationCrumb);
