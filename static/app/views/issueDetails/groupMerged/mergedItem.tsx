import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconChevron, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Fingerprint} from 'sentry/stores/groupingStore';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {createIssueLink} from 'sentry/views/issueList/utils';

interface Props {
  fingerprint: Fingerprint;
  totalFingerprint: number;
}

function MergedItem({fingerprint, totalFingerprint}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [checked, setChecked] = useState(false);

  function onGroupChange({unmergeState}: any) {
    if (!unmergeState) {
      return;
    }

    const stateForId = unmergeState.has(fingerprint.id)
      ? unmergeState.get(fingerprint.id)
      : undefined;

    if (!stateForId) {
      return;
    }

    Object.keys(stateForId).forEach(key => {
      if (key === 'collapsed') {
        setCollapsed(Boolean(stateForId[key]));
      } else if (key === 'checked') {
        setChecked(Boolean(stateForId[key]));
      } else if (key === 'busy') {
        setBusy(Boolean(stateForId[key]));
      }
    });
  }

  function handleToggleEvents() {
    GroupingStore.onToggleCollapseFingerprint(fingerprint.id);
  }

  function handleToggle() {
    const {latestEvent} = fingerprint;

    if (busy) {
      return;
    }

    // clicking anywhere in the row will toggle the checkbox
    GroupingStore.onToggleUnmerge([fingerprint.id, latestEvent.id]);
  }

  function handleCheckClick() {
    // noop because of react warning about being a controlled input without `onChange`
    // we handle change via row click
  }

  function renderFingerprint(id: string, label?: string) {
    if (!label) {
      return id;
    }

    return (
      <Tooltip title={id}>
        <code>{label}</code>
      </Tooltip>
    );
  }

  useEffect(() => {
    const teardown = GroupingStore.listen((data: any) => onGroupChange(data), undefined);
    return () => {
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {latestEvent, id, label} = fingerprint;
  const checkboxDisabled = busy || totalFingerprint === 1;

  const issueLink = latestEvent
    ? createIssueLink({
        organization,
        location,
        data: latestEvent,
        eventId: latestEvent.id,
        referrer: 'merged-item',
      })
    : null;

  // `latestEvent` can be null if last event w/ fingerprint is not within retention period
  return (
    <MergedGroup busy={busy}>
      <Controls expanded={!collapsed}>
        <FingerprintLabel onClick={handleToggle}>
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
              onChange={handleCheckClick}
              size="xs"
            />
          </Tooltip>
          {renderFingerprint(id, label)}
          {fingerprint.mergedBySeer && ' (merged by Sentry)'}
        </FingerprintLabel>

        <Button
          aria-label={
            collapsed ? t('Show %s fingerprints', id) : t('Collapse %s fingerprints', id)
          }
          size="zero"
          borderless
          icon={<IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />}
          onClick={handleToggleEvents}
        />
      </Controls>

      {!collapsed && (
        <MergedEventList>
          {issueLink ? (
            <Flex align="center" gap="xs">
              <LinkButton
                to={issueLink}
                icon={<IconLink variant="accent" />}
                title={t('View latest event')}
                aria-label={t('View latest event')}
                borderless
                size="xs"
                style={{marginLeft: space(1)}}
              />
              <EventDetails>
                <Text size="md" data-issue-title-primary>
                  {latestEvent.title}
                </Text>
              </EventDetails>
            </Flex>
          ) : null}
        </MergedEventList>
      )}
    </MergedGroup>
  );
}

const MergedGroup = styled('div')<{busy: boolean}>`
  ${p => p.busy && 'opacity: 0.2'};
`;

const Controls = styled('div')<{expanded: boolean}>`
  display: flex;
  justify-content: space-between;
  background-color: ${p => p.theme.tokens.background.secondary};
  ${p => p.expanded && `border-bottom: 1px solid ${p.theme.tokens.border.secondary}`};
  padding: ${space(0.5)} ${space(1)};

  ${MergedGroup}:not(:first-child) & {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  ${MergedGroup}:last-child & {
    ${p => !p.expanded && `border-bottom: none`};
    ${p => !p.expanded && `border-radius: 0 0 ${p.theme.radius.md} ${p.theme.radius.md}`};
  }
`;

const FingerprintLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  line-height: 1;
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
`;

const MergedEventList = styled('div')`
  overflow: hidden;
  border: none;
  background-color: ${p => p.theme.tokens.background.primary};
`;

const EventDetails = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)};
`;

export default MergedItem;
