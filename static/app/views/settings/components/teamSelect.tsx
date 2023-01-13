import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {type Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {type Organization, type Team} from 'sentry/types';
import useTeams from 'sentry/utils/useTeams';

type Props = {
  /**
   * Should button be disabled
   */
  disabled: boolean;
  /**
   * Should adding a team be disabled based
   * on whether the team is idpProvisioned
   */
  enforceIdpProvisioned: boolean;
  /**
   * callback when teams are added
   */
  onAddTeam: (team: Team) => void;
  /**
   * Callback when teams are removed
   */
  onRemoveTeam: (teamSlug: string) => void;
  organization: Organization;
  /**
   * Teams that are already selected.
   */
  selectedTeams: Team[];
  /**
   * Message to display when the last team is removed
   * if empty no confirm will be displayed.
   */
  confirmLastTeamRemoveMessage?: string;
  /**
   * Used to determine whether we should show a loading state while waiting for teams
   */
  loadingTeams?: boolean;
  /**
   * Optional menu header.
   */
  menuHeader?: React.ReactElement;
};

function TeamSelect({
  disabled,
  enforceIdpProvisioned,
  selectedTeams,
  menuHeader,
  organization,
  onAddTeam,
  onRemoveTeam,
  confirmLastTeamRemoveMessage,
  loadingTeams,
}: Props) {
  const {teams, onSearch, fetching} = useTeams();

  const handleAddTeam = (option: Item) => {
    const team = teams.find(tm => tm.slug === option.value);
    if (team) {
      onAddTeam(team);
    }
  };

  const renderBody = () => {
    if (selectedTeams.length === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }
    const confirmMessage =
      selectedTeams.length === 1 && confirmLastTeamRemoveMessage
        ? confirmLastTeamRemoveMessage
        : null;

    return selectedTeams.map(team => (
      <TeamRow
        key={team.slug}
        orgId={organization.slug}
        team={team}
        onRemove={slug => onRemoveTeam(slug)}
        disabled={disabled}
        confirmMessage={confirmMessage}
        enforceIdpProvisioned={enforceIdpProvisioned}
      />
    ));
  };

  // Only show options that aren't selected in the dropdown
  const options = teams
    .filter(team => !selectedTeams.some(selectedTeam => selectedTeam.slug === team.slug))
    .map((team, index) => ({
      index,
      value: team.slug,
      searchKey: team.slug,
      label: () => {
        if (enforceIdpProvisioned && team.flags['idp:provisioned']) {
          return (
            <Tooltip
              title={t(
                "Membership to this team is managed through your organization's identity provider."
              )}
            >
              <DropdownTeamBadgeDisabled avatarSize={18} team={team} />
            </Tooltip>
          );
        }
        return <DropdownTeamBadge avatarSize={18} team={team} />;
      },
      disabled: enforceIdpProvisioned && team.flags['idp:provisioned'],
    }));

  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Team')}
        <DropdownAutoComplete
          items={options}
          busyItemsStillVisible={fetching}
          onChange={debounce<(e: React.ChangeEvent<HTMLInputElement>) => void>(
            e => onSearch(e.target.value),
            DEFAULT_DEBOUNCE_DURATION
          )}
          onSelect={handleAddTeam}
          emptyMessage={t('No teams')}
          menuHeader={menuHeader}
          disabled={disabled}
          alignMenu="right"
        >
          {({isOpen}) => (
            <DropdownButton
              aria-label={t('Add Team')}
              isOpen={isOpen}
              size="xs"
              disabled={disabled}
            >
              {t('Add Team')}
            </DropdownButton>
          )}
        </DropdownAutoComplete>
      </PanelHeader>

      <PanelBody>{loadingTeams ? <LoadingIndicator /> : renderBody()}</PanelBody>
    </Panel>
  );
}

type TeamRowProps = {
  confirmMessage: string | null;
  disabled: boolean;
  enforceIdpProvisioned: boolean;
  onRemove: Props['onRemoveTeam'];
  orgId: string;
  team: Team;
};

const TeamRow = ({
  orgId,
  team,
  onRemove,
  disabled,
  confirmMessage,
  enforceIdpProvisioned,
}: TeamRowProps) => (
  <TeamPanelItem data-test-id="team-row">
    <StyledLink to={`/settings/${orgId}/teams/${team.slug}/`}>
      <TeamBadge team={team} />
    </StyledLink>
    <Confirm
      message={confirmMessage}
      bypass={!confirmMessage}
      onConfirm={() => onRemove(team.slug)}
      disabled={disabled || (enforceIdpProvisioned && team.flags['idp:provisioned'])}
    >
      <Button
        size="xs"
        icon={<IconSubtract isCircled size="xs" />}
        disabled={disabled || (enforceIdpProvisioned && team.flags['idp:provisioned'])}
        title={
          enforceIdpProvisioned && team.flags['idp:provisioned']
            ? t(
                "Membership to this team is managed through your organization's identity provider."
              )
            : undefined
        }
      >
        {t('Remove')}
      </Button>
    </Confirm>
  </TeamPanelItem>
);

const DropdownTeamBadge = styled(TeamBadge)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: none;
`;

const DropdownTeamBadgeDisabled = styled(TeamBadge)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: none;
  filter: grayscale(1);
`;

const TeamPanelItem = styled(PanelItem)`
  padding: ${space(2)};
  align-items: center;
`;

const StyledLink = styled(Link)`
  flex: 1;
  margin-right: ${space(1)};
`;

export default TeamSelect;
