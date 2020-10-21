import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import {Component} from 'react';

import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import IdBadge from 'app/components/idBadge';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';
import recreateRoute from 'app/utils/recreateRoute';
import withTeams from 'app/utils/withTeams';

import {CrumbLink} from '.';

class TeamCrumb extends Component {
  static propTypes = {
    teams: PropTypes.array,
    routes: PropTypes.array,
    route: PropTypes.object,
  };

  render() {
    const {teams, params, routes, route, ...props} = this.props;

    const team = teams.find(({slug}) => slug === params.teamId);
    const hasMenu = teams.length > 1;

    if (!team) {
      return null;
    }

    return (
      <BreadcrumbDropdown
        name={
          <CrumbLink
            to={recreateRoute(route, {
              routes,
              params: {...params, teamId: team.slug},
            })}
          >
            <IdBadge avatarSize={18} team={team} />
          </CrumbLink>
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
        items={teams.map(teamItem => ({
          value: teamItem.slug,
          label: (
            <MenuItem>
              <IdBadge team={teamItem} />
            </MenuItem>
          ),
        }))}
        {...props}
      />
    );
  }
}

export {TeamCrumb};
export default withTeams(TeamCrumb);
