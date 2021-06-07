import {Component, ComponentClass, ReactPortal} from 'react';
import ReactDOM from 'react-dom';
import {Manager, Popper, Reference} from 'react-popper';
import styled from '@emotion/styled';
import partition from 'lodash/partition';
import * as PopperJS from 'popper.js';

import MenuHeader from 'app/components/actions/menuHeader';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import {GetActorPropsFn} from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';
import {TeamSelection} from 'app/components/performance/teamKeyTransactionsManager';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Team} from 'app/types';
import {defined} from 'app/utils';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'app/utils/performance/constants';

export type TitleProps = Partial<ReturnType<GetActorPropsFn>> & {
  keyedTeamsCount: number;
  disabled?: boolean;
};

function canKeyForTeam(team: Team, keyedTeams: Set<string>, counts: Map<string, number>) {
  const isChecked = keyedTeams.has(team.id);
  if (isChecked) {
    return true;
  }
  return (counts.get(team.id) ?? 0) < MAX_TEAM_KEY_TRANSACTIONS;
}

type Props = {
  isLoading: boolean;
  error: string | null;
  title: ComponentClass<TitleProps>;
  handleToggleKeyTransaction: (selection: TeamSelection) => void;
  teams: Team[];
  project: number;
  transactionName: string;
  keyedTeams: Set<string> | null;
  counts: Map<string, number> | null;
  initialValue?: number;
};

type State = {
  isOpen: boolean;
};

class TeamKeyTransaction extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    let portal = document.getElementById('team-key-transaction-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.setAttribute('id', 'team-key-transaction-portal');
      document.body.appendChild(portal);
    }
    this.portalEl = portal;
    this.menuEl = null;
  }

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
    this.portalEl.remove();
  }

  private portalEl: Element;
  private menuEl: Element | null;

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
    const {handleToggleKeyTransaction} = this.props;
    return enabled ? handleToggleKeyTransaction(selection) : undefined;
  };

  renderMenuContent(counts: Map<string, number>, keyedTeams: Set<string>) {
    const {teams, project, transactionName} = this.props;

    const [enabledTeams, disabledTeams] = partition(teams, team =>
      canKeyForTeam(team, keyedTeams, counts)
    );

    const isMyTeamsEnabled = enabledTeams.length > 0;
    const myTeamsHandler = this.toggleSelection(isMyTeamsEnabled, {
      type: 'my teams',
      action: enabledTeams.length === keyedTeams.size ? 'unkey' : 'key',
      project,
      transactionName,
    });

    return (
      <DropdownContent>
        <DropdownMenuHeader first>
          {t('My Teams')}
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
              type: 'id',
              action: keyedTeams.has(team.id) ? 'unkey' : 'key',
              teamId: team.id,
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
              type: 'id',
              action: keyedTeams.has(team.id) ? 'unkey' : 'key',
              teamId: team.id,
              project,
              transactionName,
            })}
          />
        ))}
      </DropdownContent>
    );
  }

  renderMenu(): ReactPortal | null {
    const {isLoading, counts, keyedTeams} = this.props;

    if (isLoading || !defined(counts) || !defined(keyedTeams)) {
      return null;
    }

    const modifiers: PopperJS.Modifiers = {
      hide: {
        enabled: false,
      },
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
    };

    return ReactDOM.createPortal(
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
      this.portalEl
    );
  }

  render() {
    const {isLoading, error, title: Title, keyedTeams, initialValue} = this.props;
    const {isOpen} = this.state;

    const menu: ReactPortal | null = isOpen ? this.renderMenu() : null;

    return (
      <Manager>
        <Reference>
          {({ref}) => (
            <div ref={ref}>
              <Title
                disabled={isLoading || Boolean(error)}
                keyedTeamsCount={keyedTeams?.size ?? initialValue ?? 0}
                onClick={this.toggleOpen}
              />
            </div>
          )}
        </Reference>
        {menu}
      </Manager>
    );
  }
}

type ItemProps = {
  team: Team;
  isKeyed: boolean;
  disabled: boolean;
  onSelect: () => void;
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
        {team.name}
        <ActionItem>
          {disabled ? (
            t('Max %s', MAX_TEAM_KEY_TRANSACTIONS)
          ) : (
            <CheckboxFancy isChecked={isKeyed} />
          )}
        </ActionItem>
      </MenuItemContent>
    </DropdownMenuItem>
  );
}

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
  overflow-y: auto;
`;

const DropdownMenuHeader = styled(MenuHeader)<{first?: boolean}>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1.5)} ${space(2)};

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
