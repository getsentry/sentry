import {useId, useState} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t} from 'sentry/locale';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

interface PRLinksBarProps {
  repoPRStates: Record<string, RepoPRState>;
}

/** The run's PRs, pinned above the chat input so they outlive the transcript scroll. */
export function PRLinksBar({repoPRStates}: PRLinksBarProps) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  const states = Object.values(repoPRStates).filter(
    state => state.pr_creation_status !== null
  );

  // Re-open whenever Seer starts a PR in another repo.
  const [seenCount, setSeenCount] = useState(states.length);
  if (states.length !== seenCount) {
    setSeenCount(states.length);
    if (states.length > seenCount) {
      setExpanded(true);
    }
  }
  if (states.length === 0) {
    return null;
  }

  return (
    <Stack margin="lg xl 0" gap="sm" align="start">
      {expanded && (
        <Stack id={contentId} gap="sm" width="100%">
          {states.map(state => (
            <PRLinkRow key={state.repo_name} state={state} />
          ))}
        </Stack>
      )}
      {/* Below the list so it stays put, and bordered so it reads as clickable. */}
      <Button
        size="sm"
        aria-expanded={expanded}
        aria-controls={expanded ? contentId : undefined}
        onClick={() => setExpanded(value => !value)}
      >
        <Flex align="center" gap="md">
          <IconChevron size="sm" direction={expanded ? 'up' : 'right'} />
          <Text>{t('Pull requests (%s)', states.length)}</Text>
        </Flex>
      </Button>
    </Stack>
  );
}

function PRLinkRow({state}: {state: RepoPRState}) {
  // GitHub's owner/repo#number reference format.
  const prName = state.pr_number
    ? `${state.repo_name}#${state.pr_number}`
    : state.repo_name;

  // Same surface as the transcript's user messages.
  return (
    <Flex
      align="center"
      gap="md"
      minWidth="0"
      padding="md lg"
      radius="md"
      background="secondary"
      border="primary"
    >
      <IconPullRequest variant="success" />
      <Flex align="center" justify="between" gap="md" wrap="wrap" flex="1" minWidth="0">
        <Text bold wordBreak="break-word">
          {state.pr_url ? (
            <ExternalLink href={state.pr_url}>{prName}</ExternalLink>
          ) : (
            prName
          )}
        </Text>
        <PRLinkStatus state={state} />
      </Flex>
    </Flex>
  );
}

type StatusKind = 'opening' | 'pushing' | 'error' | 'view';

function getStatusKind(state: RepoPRState): StatusKind | null {
  if (state.pr_creation_status === 'creating') {
    return state.pr_number ? 'pushing' : 'opening';
  }
  if (state.pr_creation_status === 'error') {
    return 'error';
  }
  return state.pr_url ? 'view' : null;
}

/** Every status is rendered in one grid cell and all but the current one hidden, so the slot's size never changes. */
function PRLinkStatus({state}: {state: RepoPRState}) {
  const kind = getStatusKind(state);
  const layer = (layerKind: StatusKind) => ({
    area: 'status',
    align: 'center' as const,
    justify: 'end' as const,
    visibility: kind === layerKind ? ('visible' as const) : ('hidden' as const),
  });

  return (
    <Grid areas="'status'" flexShrink={0}>
      <Flex {...layer('opening')} gap="sm">
        <LoadingIndicator size={16} style={{margin: 0}} />
        <Text variant="muted" wrap="nowrap">
          {t('Opening PR…')}
        </Text>
      </Flex>
      <Flex {...layer('pushing')} gap="sm">
        <LoadingIndicator size={16} style={{margin: 0}} />
        <Text variant="muted" wrap="nowrap">
          {t('Pushing changes…')}
        </Text>
      </Flex>
      <Flex {...layer('error')}>
        <InfoText title={state.pr_creation_error} variant="danger" wrap="nowrap">
          {t('Could not open PR')}
        </InfoText>
      </Flex>
      <Flex {...layer('view')}>
        <LinkButton href={state.pr_url ?? ''} external size="xs" icon={<IconOpen />}>
          {t('View PR')}
        </LinkButton>
      </Flex>
    </Grid>
  );
}
