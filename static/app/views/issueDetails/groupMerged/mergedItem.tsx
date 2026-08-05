import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {TimeSince} from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {type FingerprintWithLatestEvent, type GroupMergedState} from './useGroupMerged';

interface Props {
  canSelect: boolean;
  fingerprint: FingerprintWithLatestEvent;
  state: GroupMergedState;
  toggleCollapsed: (fingerprintId: string) => void;
  toggleSelected: (fingerprintId: string, eventId: string) => void;
}

export function MergedItem({
  canSelect,
  fingerprint,
  state,
  toggleCollapsed,
  toggleSelected,
}: Props) {
  const organization = useOrganization();
  const theme = useTheme();
  const stateForId = state.fingerprintState.get(fingerprint.id);
  const busy = Boolean(stateForId?.busy);
  const collapsed = stateForId?.collapsed ?? state.unmergeLastCollapsed;
  const checked = Boolean(stateForId?.checked);

  function handleToggleEvents() {
    toggleCollapsed(fingerprint.id);
  }

  function handleToggle() {
    const {latestEvent} = fingerprint;

    if (busy) {
      return;
    }

    toggleSelected(fingerprint.id, latestEvent.id);
  }

  const {latestEvent, id} = fingerprint;
  const checkboxDisabledReason = canSelect
    ? undefined
    : t('To check, the list must contain 2 or more items');
  const checkboxDisabled = busy || checkboxDisabledReason !== undefined;
  const latestEventTimestamp = latestEvent.dateCreated ?? latestEvent.dateReceived;

  return (
    <MergedGroup busy={busy}>
      <Grid
        columns="minmax(0, 1fr) auto"
        align="center"
        gap="md"
        background="primary"
        padding="md"
      >
        <Flex align="center" gap="sm" minWidth={0}>
          <Tooltip
            containerDisplayMode="flex"
            disabled={checkboxDisabledReason === undefined}
            title={checkboxDisabledReason}
          >
            <Flex
              align="center"
              justify="center"
              flexShrink={0}
              width="20px"
              height="20px"
            >
              <Checkbox
                aria-label={t('Select fingerprint %s', id)}
                value={id}
                checked={checked}
                disabled={checkboxDisabled}
                onChange={handleToggle}
              />
            </Flex>
          </Tooltip>

          <Stack gap="xs" minWidth={0}>
            <Text size="md" data-issue-title-primary>
              {latestEvent.title}
            </Text>
            {(latestEventTimestamp || fingerprint.mergedBySeer) && (
              <Flex as="span" align="center" gap="sm">
                {latestEventTimestamp && (
                  <Fragment>
                    <Text as="span" size="sm" variant="muted">
                      <Link
                        to={{
                          pathname: `/organizations/${organization.slug}/issues/${latestEvent.groupID!}/events/${latestEvent.id}/`,
                          query: {
                            project: latestEvent.projectID,
                            referrer: 'merged-item',
                          },
                        }}
                      >
                        {t('Latest event')}
                      </Link>
                    </Text>
                    <Text as="span" size="sm" variant="muted">
                      <TimeSince
                        date={latestEventTimestamp}
                        unitStyle="short"
                        variant="muted"
                      />
                    </Text>
                  </Fragment>
                )}
                {fingerprint.mergedBySeer && (
                  <Text as="span" size="sm" variant="muted">
                    <Flex as="span" align="center" gap="xs">
                      {latestEventTimestamp && <span aria-hidden="true">&middot;</span>}
                      {t('Merged by Sentry')}
                    </Flex>
                  </Text>
                )}
              </Flex>
            )}
          </Stack>
        </Flex>

        <Button
          aria-label={
            collapsed ? t('Show %s fingerprints', id) : t('Collapse %s fingerprints', id)
          }
          size="zero"
          variant="transparent"
          icon={<IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />}
          onClick={handleToggleEvents}
        />
      </Grid>

      {!collapsed && (
        <Grid
          columns={`calc(${theme.space.xl} + ${theme.space.sm} - 2px) minmax(0, 1fr)`}
          align="center"
          gap="sm"
          background="secondary"
          borderTop="secondary"
          padding="md"
        >
          <FingerprintConnector aria-hidden="true" />
          <Flex align="center" gap="sm" minWidth={0}>
            <FingerprintText>
              <Text as="span" size="sm">
                {t('Fingerprint %s', id)}
              </Text>
            </FingerprintText>
          </Flex>
        </Grid>
      )}
    </MergedGroup>
  );
}

const MergedGroup = styled('div')<{busy: boolean}>`
  ${p =>
    p.busy &&
    css`
      opacity: 0.2;
    `}

  & + & {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const FingerprintConnector = styled('span')`
  position: relative;
  width: ${p => p.theme.space.xl};
  align-self: stretch;

  &::before,
  &::after {
    content: '';
    position: absolute;
    border-color: ${p => p.theme.tokens.border.secondary};
    opacity: 0.55;
  }

  &::before {
    left: calc(${p => p.theme.space.lg} - 2px);
    top: -${p => p.theme.space.md};
    height: calc(50% + ${p => p.theme.space.md});
    border-left: 1px solid;
  }

  &::after {
    left: calc(${p => p.theme.space.lg} - 2px);
    top: 50%;
    width: ${p => p.theme.space.sm};
    border-top: 1px solid;
  }
`;

const FingerprintText = styled('div')`
  overflow-wrap: anywhere;
`;
