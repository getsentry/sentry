import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {IconChevron} from 'app/icons';
import Checkbox from 'app/components/checkbox';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import FlowLayout from 'app/components/flowLayout';
import GroupingActions from 'app/actions/groupingActions';
import GroupingStore from 'app/stores/groupingStore';
import space from 'app/styles/space';

const MergedItem = createReactClass({
  displayName: 'MergedItem',

  propTypes: {
    fingerprint: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    event: PropTypes.shape({
      id: PropTypes.string,
      groupID: PropTypes.string,
      type: PropTypes.oneOf(['error', 'csp', 'default']),
      dateCreated: PropTypes.string,
      platform: PropTypes.string,
    }),
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingChange')],

  getInitialState() {
    return {
      collapsed: false,
      checked: false,
      busy: false,
    };
  },

  onGroupingChange({unmergeState}) {
    if (!unmergeState) {
      return;
    }

    const {fingerprint} = this.props;
    const stateForId = unmergeState.has(fingerprint) && unmergeState.get(fingerprint);
    if (!stateForId) {
      return;
    }

    Object.keys(stateForId).forEach(key => {
      if (stateForId[key] === this.state[key]) {
        return;
      }

      this.setState({
        [key]: stateForId[key],
      });
    });
  },

  handleToggleEvents() {
    const {fingerprint} = this.props;
    GroupingActions.toggleCollapseFingerprint(fingerprint);
  },

  // Disable default behavior of toggling checkbox
  handleLabelClick(e) {
    e.preventDefault();
  },

  handleToggle() {
    const {disabled, fingerprint, event} = this.props;

    if (disabled || this.state.busy) {
      return;
    }

    // clicking anywhere in the row will toggle the checkbox
    GroupingActions.toggleUnmerge([fingerprint, event.id]);
  },

  handleCheckClick() {
    // noop because of react warning about being a controlled input without `onChange`
    // we handle change via row click
  },

  render() {
    const {disabled, event, fingerprint} = this.props;
    const checkboxDisabled = disabled || this.state.disabled;

    // `event` can be null if last event w/ fingerprint is not within retention period
    return (
      <MergedGroup busy={this.state.busy}>
        <Controls expanded={!this.state.collapsed}>
          <FlowLayout onClick={this.handleToggle}>
            <ActionColumn>
              <Checkbox
                id={fingerprint}
                value={fingerprint}
                checked={this.state.checked}
                disabled={checkboxDisabled}
                onChange={this.handleCheckClick}
              />
            </ActionColumn>

            <Fingerprint onClick={this.handleLabelClick} htmlFor={fingerprint}>
              {fingerprint}
            </Fingerprint>
          </FlowLayout>

          <div>
            <span />
            <Collapse onClick={this.handleToggleEvents}>
              {this.state.collapsed ? (
                <IconChevron direction="down" size="xs" />
              ) : (
                <IconChevron direction="up" size="xs" />
              )}
            </Collapse>
          </div>
        </Controls>

        {!this.state.collapsed && (
          <MergedEventList className="event-list">
            {event && (
              <EventDetails className="event-details">
                <FlowLayout>
                  <EventOrGroupHeader data={event} hideIcons hideLevel />
                </FlowLayout>
              </EventDetails>
            )}
          </MergedEventList>
        )}
      </MergedGroup>
    );
  },
});

const MergedGroup = styled('div')`
  ${p => p.busy && 'opacity: 0.2'};
`;

const ActionColumn = styled('div')`
  display: flex;
  padding: 0 10px;
  align-items: center;

  input {
    margin: 0;
  }
`;

const Controls = styled('div')`
  display: flex;
  justify-content: space-between;
  border-top: 1px solid ${p => p.theme.innerBorder};
  background-color: #f3f1f6;
  padding: ${space(0.5)} 0;
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
    font-weight: normal;
    margin: 0;
  }
`;

const Collapse = styled('span')`
  cursor: pointer;
  padding: 0 10px;
`;

const MergedEventList = styled('div')`
  overflow: hidden;
  border: none;
`;

const EventDetails = styled('div')`
  display: flex;
  justify-content: space-between;

  .event-list & {
    padding: 10px;
  }
`;

export default MergedItem;
