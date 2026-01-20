import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {Button} from 'sentry/components/core/button';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

export type TeamSelectProps = {
  /**
   * Should button be disabled
   */
  disabled: boolean;
  /**
   * callback when teams are added
   */
  onAddTeam: (teamSlug: string) => void;
  /**
   * Callback when teams are removed
   */
  onRemoveTeam: (teamSlug: string) => void;
  organization: Organization;
  /**
   * Used to determine whether we should show a loading state while waiting for teams
   */
  loadingTeams?: boolean;
  /**
   * Callback when teams are created
   */
  onCreateTeam?: (team: Team) => void;
};

export function DropdownAddTeam({
  disabled,
  isLoadingTeams,
  isAddingTeamToMember = false,
  onSearch,
  onSelect,
  onCreateTeam,
  organization,
  selectedTeams,
  teams,
  project,
}: {
  disabled: boolean;
  isLoadingTeams: boolean;
  onSearch: (teamSlug: string) => void;
  onSelect: (teamSlug: string) => void;
  organization: Organization;
  selectedTeams: string[];
  teams: Team[];
  canCreateTeam?: boolean;
  isAddingTeamToMember?: boolean;
  onCreateTeam?: (team: Team) => void;
  project?: Project;
}) {
  const dropdownItems = teams
    .filter(team => !selectedTeams.includes(team.slug))
    .map<SelectOption<string>>(team => {
      const isIdpProvisioned = isAddingTeamToMember && team.flags['idp:provisioned'];

      return {
        value: team.slug,
        textValue: team.slug,
        leadingItems: <TeamAvatar team={team} size={16} />,
        label: `#${team.slug}`,
        disabled: disabled || isIdpProvisioned,
        tooltip: getButtonHelpText(isIdpProvisioned),
        hideCheck: true,
      };
    });

  const canCreateTeam = hasEveryAccess(['org:write'], {organization, project});

  return (
    <CompactSelect
      size="xs"
      value=""
      menuWidth={300}
      options={dropdownItems}
      disabled={false}
      onClose={() => onSearch('')}
      onChange={selection => onSelect(selection.value)}
      menuTitle={<Text size="sm">{t('Teams')}</Text>}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps}>{t('Add Team')}</OverlayTrigger.Button>
      )}
      searchPlaceholder={t('Search Teams')}
      emptyMessage={t('No Teams')}
      loading={isLoadingTeams}
      searchable
      onSearch={onSearch}
      menuHeaderTrailingItems={({closeOverlay}) => {
        return (
          <Button
            title={
              canCreateTeam
                ? undefined
                : t('You must be a Org Owner/Manager to create teams')
            }
            borderless
            priority="link"
            size="xs"
            disabled={!canCreateTeam}
            onClick={() => {
              openCreateTeamModal({
                organization,
                project,
                onClose: onCreateTeam,
              });
              closeOverlay();
            }}
          >
            {t('Create Team')}
          </Button>
        );
      }}
    />
  );
}
