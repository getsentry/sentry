import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import recreateRoute from 'sentry/utils/recreateRoute';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useTeams} from 'sentry/utils/useTeams';
import type {SettingsBreadcrumbProps} from 'sentry/views/settings/components/settingsBreadcrumb/types';

import BreadcrumbDropdown from './breadcrumbDropdown';
import {CrumbLink} from '.';

function TeamCrumb({routes, route, ...props}: SettingsBreadcrumbProps) {
  const navigate = useNavigate();
  const {teams, onSearch, fetching} = useTeams();
  const params = useParams();

  const team = teams.find(({slug}) => slug === params.teamId);
  const hasMenu = teams.length > 1;

  if (!team) {
    return null;
  }
  const teamUrl = `/settings/${params.orgId}/teams/${team.slug}/`;

  return (
    <BreadcrumbDropdown
      name={
        <CrumbLink to={teamUrl}>
          <IdBadge avatarSize={18} team={team} />
        </CrumbLink>
      }
      onCrumbSelect={teamSlug => {
        navigate(
          recreateRoute('', {
            routes,
            params: {...params, teamId: teamSlug},
          })
        );
      }}
      onOpenChange={open => {
        if (open) {
          trackAnalytics('breadcrumbs.menu.opened', {organization: null});
        }
      }}
      hasMenu={hasMenu}
      route={route}
      value={team.slug}
      searchPlaceholder={t('Search Teams')}
      options={teams.map(teamItem => ({
        value: teamItem.slug,
        leadingItems: <TeamAvatar team={teamItem} size={16} />,
        label: `#${teamItem.slug}`,
      }))}
      onSearch={onSearch}
      loading={fetching}
      {...props}
    />
  );
}

export default TeamCrumb;
