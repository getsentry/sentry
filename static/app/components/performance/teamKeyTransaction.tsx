import {Component, Fragment} from 'react';
import {createPortal} from 'react-dom';
import {Manager, Popper, Reference} from 'react-popper';
import styled from '@emotion/styled';

import MenuHeader from 'sentry/components/actions/menuHeader';
import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import {GetActorPropsFn} from 'sentry/components/deprecatedDropdownMenu';
import MenuItem from 'sentry/components/menuItem';
import {TeamSelection} from 'sentry/components/performance/teamKeyTransactionsManager';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, Team} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'sentry/utils/performance/constants';

export type TitleProps = Partial<ReturnType<GetActorPropsFn>> & {
  isOpen: boolean;
  keyedTeams: Team[] | null;
  disabled?: boolean;
  initialValue?: number;
};

type Props = {
  counts: Map<string, number> | null;
  error: string | null;
  handleToggleKeyTransaction: (selection: TeamSelection) => void;
  isLoading: boolean;
  keyedTeams: Set<string> | null;
  organization: Organization;
  project: Project;
  teams: Team[];
  title: React.ComponentType<TitleProps>;
  transactionName: string;
  initialValue?: number;
};

type State = {
  isOpen: boolean;
};

class TeamKeyTransaction extends Component<Props, State> {
  state: State = {
    isOpen: false,
  };

  componentDidUpdate(_props: Props, prevState: State) {
    if (this.state.isOpen && prevState.isOpen === false) {
      document.addEventListener('click', this.handleClickOutside, true);
    }
    if (this.state.isOpen === false && prevState.isOpen) {
      document.removeEventListener('click', this.handleClickOutside, true);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside, true);
  }

  private menuEl: Element | null = null;

  handleClickOutside = (event: MouseEvent) => {
    if (!this.menuEl) {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    if (this.menuEl.contains(event.target)) {
      return;
    }
    this.setState({isOpen: false});
  };

  toggleOpen = () => {
    this.setState(({isOpen}) => ({isOpen: !isOpen}));
  };

  toggleSelection = (enabled: boolean, selection: TeamSelection) => () => {
    const {handleToggleKeyTransaction, organization} = this.props;
    const {action} = selection;
    trackAdvancedAnalyticsEvent('performance_views.team_key_transaction.set', {
      organization,
      action,
    });

    return enabled ? handleToggleKeyTransaction(selection) : undefined;
  };

  partitionTeams(counts: Map<string, number>, keyedTeams: Set<string>) {
    const {teams, project} = this.props;

    const enabledTeams: Team[] = [];
    const disabledTeams: Team[] = [];
    const noAccessTeams: Team[] = [];

    const projectTeams = new Set(project.teams.map(({id}) => id));
    for (const team of teams) {
      if (!projectTeams.has(team.id)) {
        noAccessTeams.push(team);
      } else if (
        keyedTeams.has(team.id) ||
        (counts.get(team.id) ?? 0) < MAX_TEAM_KEY_TRANSACTIONS
      ) {
        enabledTeams.push(team);
      } else {
        disabledTeams.push(team);
      }
    }

    return {
      enabledTeams,
      disabledTeams,
      noAccessTeams,
    };
  }

  renderMenuContent(counts: Map<string, number>, keyedTeams: Set<string>) {
    const {teams, project, transactionName} = this.props;

    const {enabledTeams, disabledTeams, noAccessTeams} = this.partitionTeams(
      counts,
      keyedTeams
    );

    const isMyTeamsEnabled = enabledTeams.length > 0;
    const myTeamsHandler = this.toggleSelection(isMyTeamsEnabled, {
      action: enabledTeams.length === keyedTeams.size ? 'unkey' : 'key',
      teamIds: enabledTeams.map(({id}) => id),
      project,
      transactionName,
    });

    const hasTeamsWithAccess = enabledTeams.length + disabledTeams.length > 0;

    return (
      <DropdownContent>
        {hasTeamsWithAccess && (
          <Fragment>
            <DropdownMenuHeader first>
              {t('My Teams with Access')}
              <ActionItem>
                <CheckboxFancy
                  isDisabled={!isMyTeamsEnabled}
                  isChecked={teams.length === keyedTeams.size}
                  isIndeterminate={teams.length > keyedTeams.size && keyedTeams.size > 0}
                  onClick={myTeamsHandler}
                />
              </ActionItem>
            </DropdownMenuHeader>
            {enabledTeams.map(team => (
              <TeamKeyTransactionItem
                key={team.slug}
                team={team}
                isKeyed={keyedTeams.has(team.id)}
                disabled={false}
                onSelect={this.toggleSelection(true, {
                  action: keyedTeams.has(team.id) ? 'unkey' : 'key',
                  teamIds: [team.id],
                  project,
                  transactionName,
                })}
              />
            ))}
            {disabledTeams.map(team => (
              <TeamKeyTransactionItem
                key={team.slug}
                team={team}
                isKeyed={keyedTeams.has(team.id)}
                disabled
                onSelect={this.toggleSelection(true, {
                  action: keyedTeams.has(team.id) ? 'unkey' : 'key',
                  teamIds: [team.id],
                  project,
                  transactionName,
                })}
              />
            ))}
          </Fragment>
        )}
        {noAccessTeams.length > 0 && (
          <Fragment>
            <DropdownMenuHeader first={!hasTeamsWithAccess}>
              {t('My Teams without Access')}
            </DropdownMenuHeader>
            {noAccessTeams.map(team => (
              <TeamKeyTransactionItem key={team.slug} team={team} disabled />
            ))}
          </Fragment>
        )}
      </DropdownContent>
    );
  }

  renderMenu(): React.ReactPortal | null {
    const {isLoading, counts, keyedTeams} = this.props;

    if (isLoading || !defined(counts) || !defined(keyedTeams)) {
      return null;
    }

    const modifiers = [
      {
        name: 'hide',
        enabled: false,
      },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {padding: 10},
      },
    ];

    return createPortal(
      <Popper placement="top" modifiers={modifiers}>
        {({ref: popperRef, style, placement}) => (
          <DropdownWrapper
            ref={ref => {
              (popperRef as Function)(ref);
              this.menuEl = ref;
            }}
            style={style}
            data-placement={placement}
          >
            {this.renderMenuContent(counts, keyedTeams)}
          </DropdownWrapper>
        )}
      </Popper>,
      document.body
    );
  }

  render() {
    const {isLoading, error, title: Title, keyedTeams, initialValue, teams} = this.props;
    const {isOpen} = this.state;

    const menu: React.ReactPortal | null = isOpen ? this.renderMenu() : null;

    return (
      <Manager>
        <Reference>
          {({ref}) => (
            <StarWrapper ref={ref}>
              <Title
                isOpen={isOpen}
                disabled={isLoading || Boolean(error)}
                keyedTeams={
                  keyedTeams ? teams.filter(({id}) => keyedTeams.has(id)) : null
                }
                initialValue={initialValue}
                onClick={this.toggleOpen}
              />
            </StarWrapper>
          )}
        </Reference>
        {menu}
      </Manager>
    );
  }
}

type ItemProps = {
  disabled: boolean;
  team: Team;
  isKeyed?: boolean;
  onSelect?: () => void;
};

function TeamKeyTransactionItem({team, isKeyed, disabled, onSelect}: ItemProps) {
  return (
    <DropdownMenuItem
      key={team.slug}
      disabled={disabled}
      onSelect={onSelect}
      stopPropagation
    >
      <MenuItemContent>
        {team.slug}
        <ActionItem>
          {!defined(isKeyed) ? null : disabled ? (
            t('Max %s', MAX_TEAM_KEY_TRANSACTIONS)
          ) : (
            <CheckboxFancy isChecked={isKeyed} />
          )}
        </ActionItem>
      </MenuItemContent>
    </DropdownMenuItem>
  );
}

const StarWrapper = styled('div')`
  display: flex;

  /* Fixes Star when it’s filled and is wrapped around Tooltip */
  & > span {
    display: flex;
  }
`;

const DropdownWrapper = styled('div')`
  /* Adapted from the dropdown-menu class */
  border: none;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(52, 60, 69, 0.2), 0 1px 3px rgba(70, 82, 98, 0.25);
  background-clip: padding-box;
  background-color: ${p => p.theme.background};
  width: 220px;
  overflow: visible;
  z-index: ${p => p.theme.zIndex.tooltip};

  &:before,
  &:after {
    width: 0;
    height: 0;
    content: '';
    display: block;
    position: absolute;
    right: auto;
  }

  &:before {
    border-left: 9px solid transparent;
    border-right: 9px solid transparent;
    left: calc(50% - 9px);
    z-index: -2;
  }

  &:after {
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    left: calc(50% - 8px);
    z-index: -1;
  }

  &[data-placement*='bottom'] {
    margin-top: 9px;

    &:before {
      border-bottom: 9px solid ${p => p.theme.border};
      top: -9px;
    }

    &:after {
      border-bottom: 8px solid ${p => p.theme.background};
      top: -8px;
    }
  }

  &[data-placement*='top'] {
    margin-bottom: 9px;

    &:before {
      border-top: 9px solid ${p => p.theme.border};
      bottom: -9px;
    }

    &:after {
      border-top: 8px solid ${p => p.theme.background};
      bottom: -8px;
    }
  }
`;

const DropdownContent = styled('div')`
  max-height: 250px;
  pointer-events: auto;
  overflow-y: auto;
`;

const DropdownMenuHeader = styled(MenuHeader)<{first?: boolean}>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};

  background: ${p => p.theme.backgroundSecondary};
  ${p => p.first && 'border-radius: 2px'};
`;

const DropdownMenuItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const MenuItemContent = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const ActionItem = styled('span')`
  min-width: ${space(2)};
  margin-left: ${space(1)};
`;

export default TeamKeyTransaction;
