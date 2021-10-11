import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import debounce from 'lodash/debounce';

import IdBadge from 'app/components/idBadge';
import {DEFAULT_DEBOUNCE_DURATION} from 'app/constants';
import recreateRoute from 'app/utils/recreateRoute';
import useTeams from 'app/utils/useTeams';
import BreadcrumbDropdown from 'app/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import MenuItem from 'app/views/settings/components/settingsBreadcrumb/menuItem';

import {RouteWithName} from './types';
import {CrumbLink} from '.';

type Props = RouteComponentProps<{teamId: string}, {}> & {
  routes: RouteWithName[];
  route?: RouteWithName;
};

const TeamCrumb = ({params, routes, route, ...props}: Props) => {
  const {teams, onSearch, fetching} = useTeams();

  const team = teams.find(({slug}) => slug === params.teamId);
  const hasMenu = teams.length > 1;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onSearch(query);
  };
  const debouncedHandleSearch = debounce(handleSearchChange, DEFAULT_DEBOUNCE_DURATION);

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
      items={teams.map((teamItem, index) => ({
        index,
        value: teamItem.slug,
        label: (
          <MenuItem>
            <IdBadge team={teamItem} />
          </MenuItem>
        ),
      }))}
      onChange={debouncedHandleSearch}
      busyItemsStillVisible={fetching}
      {...props}
    />
  );
};

export default TeamCrumb;
