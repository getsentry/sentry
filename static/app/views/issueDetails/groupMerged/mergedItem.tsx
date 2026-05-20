import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconChevron, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {createIssueLink} from 'sentry/views/issueList/utils';

import {type FingerprintWithLatestEvent, useGroupMerged} from './useGroupMerged';

interface Props {
  fingerprint: FingerprintWithLatestEvent;
  totalFingerprint: number;
}

export function MergedItem({fingerprint, totalFingerprint}: Props) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const {state, toggleCollapsed, toggleSelected} = useGroupMerged();
  const stateForId = state.fingerprintState.get(fingerprint.id);
  const busy = Boolean(stateForId?.busy);
  const collapsed = Boolean(stateForId?.collapsed);
  const checked = Boolean(stateForId?.checked);

  function handleToggleEvents() {
    toggleCollapsed(fingerprint.id);
  }

  function handleToggle() {
    const {latestEvent} = fingerprint;

    if (busy) {
      return;
    }

    // clicking anywhere in the row will toggle the checkbox
    toggleSelected(fingerprint.id, latestEvent.id);
  }

  function handleCheckClick() {
    // noop because of react warning about being a controlled input without `onChange`
    // we handle change via row click
  }

  const {latestEvent, id} = fingerprint;
  const checkboxDisabled = busy || totalFingerprint === 1;

  const issueLink = createIssueLink({
    organization,
    location,
    data: latestEvent,
    eventId: latestEvent.id,
    referrer: 'merged-item',
  });

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
          {id}
          {fingerprint.mergedBySeer && ' (merged by Sentry)'}
        </FingerprintLabel>

        <Button
          aria-label={
            collapsed ? t('Show %s fingerprints', id) : t('Collapse %s fingerprints', id)
          }
          size="zero"
          variant="transparent"
          icon={<IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />}
          onClick={handleToggleEvents}
        />
      </Controls>

      {!collapsed && (
        <MergedEventList>
          <Flex align="center" gap="xs">
            <LinkButton
              to={issueLink}
              icon={<IconLink variant="accent" />}
              tooltipProps={{title: t('View latest event')}}
              aria-label={t('View latest event')}
              variant="transparent"
              size="xs"
              style={{marginLeft: theme.space.md}}
            />
            <Flex justify="between" padding="md">
              <Text size="md" data-issue-title-primary>
                {latestEvent.title}
              </Text>
            </Flex>
          </Flex>
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
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};

  ${MergedGroup}:not(:first-child) & {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  ${MergedGroup}:last-child & {
    ${p => !p.expanded && 'border-bottom: none'};
    ${p => !p.expanded && `border-radius: 0 0 ${p.theme.radius.md} ${p.theme.radius.md}`};
  }
`;

const FingerprintLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  font-family: ${p => p.theme.font.family.mono};
  line-height: 1;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  margin: 0;
`;

const MergedEventList = styled('div')`
  overflow: hidden;
  border: none;
  background-color: ${p => p.theme.tokens.background.primary};
`;
