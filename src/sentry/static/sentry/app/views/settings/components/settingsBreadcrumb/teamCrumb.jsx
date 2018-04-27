import {Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';
import TextLink from 'app/components/textLink';
import recreateRoute from 'app/utils/recreateRoute';
import withTeams from 'app/utils/withTeams';

class TeamCrumb extends React.Component {
  static propTypes = {
    teams: PropTypes.array,
    routes: PropTypes.array,
    route: PropTypes.object,
  };

  render() {
    let {teams, params, routes, route, ...props} = this.props;

    let team = teams.find(({slug}) => slug === params.teamId);
    let hasMenu = teams.length > 1;

    if (!team) return null;

    return (
      <BreadcrumbDropdown
        name={
          <TextLink
            to={recreateRoute(route, {
              routes,
              params: {...params, teamId: team.slug},
            })}
          >
            <Flex align="center">#{team.slug}</Flex>
          </TextLink>
        }
        onSelect={item => {
          browserHistory.push(
            recreateRoute('', {
              routes,
              params: {...params, teamId: item.value},
            })
          );
        }}
        hasMenu={hasMenu}
        route={route}
        items={teams.map(({slug}) => ({
          value: slug,
          label: <MenuItem>#{slug}</MenuItem>,
        }))}
        {...props}
      />
    );
  }
}

export {TeamCrumb};
export default withTeams(TeamCrumb);
