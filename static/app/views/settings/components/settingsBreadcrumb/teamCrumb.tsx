import {browserHistory, RouteComponentProps} from 'react-router';
import debounce from 'lodash/debounce';

import IdBadge from 'sentry/components/idBadge';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import recreateRoute from 'sentry/utils/recreateRoute';
import useTeams from 'sentry/utils/useTeams';
import BreadcrumbDropdown from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbDropdown';
import MenuItem from 'sentry/views/settings/components/settingsBreadcrumb/menuItem';

import {CrumbLink} from '.';

type Props = RouteComponentProps<{teamId: string}, {}>;

const TeamCrumb = ({params, routes, route, ...props}: Props) => {
  const {teams, onSearch, fetching} = useTeams();

  const team = teams.find(({slug}) => slug === params.teamId);
  const hasMenu = teams.length > 1;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
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
