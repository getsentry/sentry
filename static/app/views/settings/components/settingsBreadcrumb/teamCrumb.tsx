import {TeamAvatar} from '@sentry/scraps/avatar';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {recreateRoute} from 'sentry/utils/recreateRoute';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useTeams} from 'sentry/utils/useTeams';
import type {SettingsBreadcrumbProps} from 'sentry/views/settings/components/settingsBreadcrumb/types';

import {SettingsBreadcrumbSlot} from './settingsBreadcrumbSlot';

export function TeamCrumb({
  routes,
  route: _route,
  ...slotProps
}: SettingsBreadcrumbProps) {
  const navigate = useNavigate();
  const {teams, onSearch, fetching} = useTeams();
  const params = useParams();

  const team = teams.find(({slug}) => slug === params.teamId);
  const hasMenu = teams.length > 1;

  const teamSlug = team?.slug ?? params.teamId;
  const teamUrl = `/settings/${params.orgId}/teams/${teamSlug}/`;

  return (
    <SettingsBreadcrumbSlot
      {...slotProps}
      label={`#${teamSlug}`}
      leadingGraphic={team && <TeamAvatar team={team} size={16} />}
      to={teamUrl}
      onCrumbSelect={selectedTeamSlug => {
        navigate(
          recreateRoute('', {
            routes,
            params: {...params, teamId: selectedTeamSlug},
          })
        );
      }}
      onOpenChange={open => {
        if (open) {
          trackAnalytics('breadcrumbs.menu.opened', {organization: null});
        }
      }}
      hasMenu={hasMenu}
      value={teamSlug}
      search={{placeholder: t('Search Teams'), onChange: onSearch}}
      options={teams.map(teamItem => ({
        value: teamItem.slug,
        leadingItems: <TeamAvatar team={teamItem} size={16} />,
        label: `#${teamItem.slug}`,
      }))}
      loading={fetching}
    />
  );
}
