import React from 'react';
import styled from '@emotion/styled';

import GroupingActions from 'app/actions/groupingActions';
import Checkbox from 'app/components/checkbox';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import {IconChevron} from 'app/icons';
import GroupingStore from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Event} from 'app/types/event';

type Props = {
  event: Event;
  organization: Organization;
  fingerprint: string;
  disabled: boolean;
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

  componentWillUnmount() {
    this.listener?.();
  }

  listener = GroupingStore.listen(data => this.onGroupChange(data), undefined);

  onGroupChange = ({unmergeState}) => {
    if (!unmergeState) {
      return;
    }

    const {fingerprint} = this.props;
    const stateForId = unmergeState.has(fingerprint)
      ? unmergeState.get(fingerprint)
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
    GroupingActions.toggleCollapseFingerprint(fingerprint);
  };

  // Disable default behavior of toggling checkbox
  handleLabelClick(event: React.MouseEvent) {
    event.preventDefault();
  }

  handleToggle = () => {
    const {disabled, fingerprint, event} = this.props;

    if (disabled || this.state.busy) {
      return;
    }

    // clicking anywhere in the row will toggle the checkbox
    GroupingActions.toggleUnmerge([fingerprint, event.id]);
  };

  handleCheckClick() {
    // noop because of react warning about being a controlled input without `onChange`
    // we handle change via row click
  }

  render() {
    const {disabled, event, fingerprint, organization} = this.props;
    const {collapsed, busy, checked} = this.state;
    const checkboxDisabled = disabled || busy;

    // `event` can be null if last event w/ fingerprint is not within retention period
    return (
      <MergedGroup busy={busy}>
        <Controls expanded={!collapsed}>
          <ActionWrapper onClick={this.handleToggle}>
            <Checkbox
              id={fingerprint}
              value={fingerprint}
              checked={checked}
              disabled={checkboxDisabled}
              onChange={this.handleCheckClick}
            />

            <Fingerprint onClick={this.handleLabelClick} htmlFor={fingerprint}>
              {fingerprint}
            </Fingerprint>
          </ActionWrapper>

          <div>
            <Collapse onClick={this.handleToggleEvents}>
              <IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />
            </Collapse>
          </div>
        </Controls>

        {!collapsed && (
          <MergedEventList className="event-list">
            {event && (
              <EventDetails className="event-details">
                <EventOrGroupHeader
                  data={event}
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

const Fingerprint = styled('label')`
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
