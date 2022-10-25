import {Component} from 'react';
import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Tooltip from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupingStore, {Fingerprint} from 'sentry/stores/groupingStore';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type Props = {
  fingerprint: Fingerprint;
  organization: Organization;
  totalFingerprint: number;
};

type State = {
  busy: boolean;
  checked: boolean;
  collapsed: boolean;
};

class MergedItem extends Component<Props, State> {
  state: State = {
    collapsed: false,
    checked: false,
    busy: false,
  };

  listener = GroupingStore.listen(data => this.onGroupChange(data), undefined);

  onGroupChange = ({unmergeState}) => {
    if (!unmergeState) {
      return;
    }

    const {fingerprint} = this.props;
    const stateForId = unmergeState.has(fingerprint.id)
      ? unmergeState.get(fingerprint.id)
      : undefined;

    if (!stateForId) {
      return;
    }

    Object.keys(stateForId).forEach(key => {
      if (stateForId[key] === this.state[key]) {
        return;
      }

      this.setState(prevState => ({...prevState, [key]: stateForId[key]}));
    });
  };

  handleToggleEvents = () => {
    const {fingerprint} = this.props;
    GroupingStore.onToggleCollapseFingerprint(fingerprint.id);
  };

  // Disable default behavior of toggling checkbox
  handleLabelClick(event: React.MouseEvent) {
    event.preventDefault();
  }

  handleToggle = () => {
    const {fingerprint} = this.props;
    const {latestEvent} = fingerprint;

    if (this.state.busy) {
      return;
    }

    // clicking anywhere in the row will toggle the checkbox
    GroupingStore.onToggleUnmerge([fingerprint.id, latestEvent.id]);
  };

  handleCheckClick() {
    // noop because of react warning about being a controlled input without `onChange`
    // we handle change via row click
  }

  renderFingerprint(id: string, label?: string) {
    if (!label) {
      return id;
    }

    return (
      <Tooltip title={id}>
        <code>{label}</code>
      </Tooltip>
    );
  }

  render() {
    const {fingerprint, organization, totalFingerprint} = this.props;
    const {latestEvent, id, label} = fingerprint;
    const {collapsed, busy, checked} = this.state;
    const checkboxDisabled = busy || totalFingerprint === 1;

    // `latestEvent` can be null if last event w/ fingerprint is not within retention period
    return (
      <MergedGroup busy={busy}>
        <Controls expanded={!collapsed}>
          <ActionWrapper onClick={this.handleToggle}>
            <Tooltip
              disabled={!checkboxDisabled}
              title={
                checkboxDisabled && totalFingerprint === 1
                  ? t('To check, the list must contain 2 or more items')
                  : undefined
              }
            >
              <Checkbox
                id={id}
                value={id}
                checked={checked}
                disabled={checkboxDisabled}
                onChange={this.handleCheckClick}
              />
            </Tooltip>

            <FingerprintLabel onClick={this.handleLabelClick} htmlFor={id}>
              {this.renderFingerprint(id, label)}
            </FingerprintLabel>
          </ActionWrapper>

          <div>
            <Collapse onClick={this.handleToggleEvents}>
              <IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />
            </Collapse>
          </div>
        </Controls>

        {!collapsed && (
          <MergedEventList className="event-list">
            {latestEvent && (
              <EventDetails className="event-details">
                <EventOrGroupHeader
                  data={latestEvent}
                  organization={organization}
                  hideIcons
                  hideLevel
                  source="merged-item"
                />
              </EventDetails>
            )}
          </MergedEventList>
        )}
      </MergedGroup>
    );
  }
}

const MergedGroup = styled('div')<{busy: boolean}>`
  ${p => p.busy && 'opacity: 0.2'};
`;

const ActionWrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};

  /* Can't use styled components for this because of broad selector */
  input[type='checkbox'] {
    margin: 0;
  }
`;

const Controls = styled('div')<{expanded: boolean}>`
  display: flex;
  justify-content: space-between;
  border-top: 1px solid ${p => p.theme.innerBorder};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${space(0.5)} ${space(1)};
  ${p => p.expanded && `border-bottom: 1px solid ${p.theme.innerBorder}`};

  ${MergedGroup} {
    &:first-child & {
      border-top: none;
    }
    &:last-child & {
      border-top: none;
      border-bottom: 1px solid ${p => p.theme.innerBorder};
    }
  }
`;

const FingerprintLabel = styled('label')`
  font-family: ${p => p.theme.text.familyMono};

  ${Controls} & {
    font-weight: 400;
    margin: 0;
  }
`;

const Collapse = styled('span')`
  cursor: pointer;
`;

const MergedEventList = styled('div')`
  overflow: hidden;
  border: none;
  background-color: ${p => p.theme.background};
`;

const EventDetails = styled('div')`
  display: flex;
  justify-content: space-between;

  .event-list & {
    padding: ${space(1)};
  }
`;

export default MergedItem;
