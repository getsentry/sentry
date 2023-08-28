import {Component} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupingStore, {Fingerprint} from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
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
          <FingerprintLabel onClick={this.handleToggle}>
            <Tooltip
              containerDisplayMode="flex"
              disabled={!checkboxDisabled}
              title={
                checkboxDisabled && totalFingerprint === 1
                  ? t('To check, the list must contain 2 or more items')
                  : undefined
              }
            >
              <Checkbox
                value={id}
                checked={checked}
                disabled={checkboxDisabled}
                onChange={this.handleCheckClick}
                size="xs"
              />
            </Tooltip>

            {this.renderFingerprint(id, label)}
          </FingerprintLabel>

          <Button
            aria-label={
              collapsed
                ? t('Show %s fingerprints', id)
                : t('Collapse %s fingerprints', id)
            }
            size="zero"
            borderless
            icon={<IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />}
            onClick={this.handleToggleEvents}
          />
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

const Controls = styled('div')<{expanded: boolean}>`
  display: flex;
  justify-content: space-between;
  background-color: ${p => p.theme.backgroundSecondary};
  ${p => p.expanded && `border-bottom: 1px solid ${p.theme.innerBorder}`};
  padding: ${space(0.5)} ${space(1)};

  ${MergedGroup}:not(:first-child) & {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }

  ${MergedGroup}:last-child & {
    ${p => !p.expanded && `border-bottom: none`};
    ${p =>
      !p.expanded &&
      `border-radius: 0 0 ${p.theme.borderRadius} ${p.theme.borderRadius}`};
  }
`;

const FingerprintLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  line-height: 1;
  font-weight: 400;
  margin: 0;
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
