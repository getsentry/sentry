import {TeamAvatar} from '@sentry/scraps/avatar';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useTeams} from 'sentry/utils/useTeams';
import type {SettingsBreadcrumbSelectorProps} from 'sentry/views/settings/components/settingsBreadcrumb/types';

import {SettingsBreadcrumbSelector} from './settingsBreadcrumbSelector';

export function TeamCrumb({to, switchTo, children}: SettingsBreadcrumbSelectorProps) {
  const navigate = useNavigate();
  const {teams, onSearch, fetching} = useTeams();
  const params = useParams();

  const team = teams.find(({slug}) => slug === params.teamId);
  const hasMenu = teams.length > 1;

  const teamSlug = team?.slug ?? params.teamId;

  return (
    <SettingsBreadcrumbSelector
      label={`#${teamSlug}`}
      leadingGraphic={team && <TeamAvatar team={team} size={16} />}
      to={replaceRouterParams(to, params)}
      onCrumbSelect={selectedTeamSlug => {
        navigate(
          normalizeUrl(
            replaceRouterParams(switchTo, {...params, teamId: selectedTeamSlug})
          )
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
    >
      {children}
    </SettingsBreadcrumbSelector>
  );
}
