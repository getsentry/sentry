import * as React from 'react';
import styled from '@emotion/styled';

import GroupingActions from 'app/actions/groupingActions';
import Checkbox from 'app/components/checkbox';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import Tooltip from 'app/components/tooltip';
import {IconChevron} from 'app/icons';
import GroupingStore, {Fingerprint} from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {Organization} from 'app/types';

type Props = {
  organization: Organization;
  fingerprint: Fingerprint;
};

type State = {
  collapsed: boolean;
  checked: boolean;
  busy: boolean;
};

class MergedItem extends React.Component<Props, State> {
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
    GroupingActions.toggleCollapseFingerprint(fingerprint.id);
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
    GroupingActions.toggleUnmerge([fingerprint.id, latestEvent.id]);
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
    const {fingerprint, organization} = this.props;
    const {latestEvent, id, label} = fingerprint;
    const {collapsed, busy, checked} = this.state;
    const checkboxDisabled = busy;

    // `latestEvent` can be null if last event w/ fingerprint is not within retention period
    return (
      <MergedGroup busy={busy}>
        <Controls expanded={!collapsed}>
          <ActionWrapper onClick={this.handleToggle}>
            <Checkbox
              id={id}
              value={id}
              checked={checked}
              disabled={checkboxDisabled}
              onChange={this.handleCheckClick}
            />

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
  background-color: ${p => p.theme.gray100};
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

  ${/* sc-selector */ Controls} & {
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
`;

const EventDetails = styled('div')`
  display: flex;
  justify-content: space-between;

  .event-list & {
    padding: ${space(1)};
  }
`;

export default MergedItem;
