import {Fragment} from 'react';
import {IconOpen} from '@sentry/icons/open';
import {IconPullRequest} from '@sentry/icons/pullRequest';
import {IconUpload} from '@sentry/icons/upload';
import {IconWarning} from '@sentry/icons/warning';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';
import type {RepoChanges} from 'sentry/views/seerExplorer/runChanges';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

interface PRLinksBarProps {
  repoPRStates: Record<string, RepoPRState>;
  /** The run's changes per repo. Each gets a button that opens them with `onOpenChanges`. */
  changes?: RepoChanges[];
  /** Whether Seer is working, which disables `onPushChanges`. */
  isAgentBusy?: boolean;
  onOpenChanges?: (repoName: string) => void;
  /** Asks Seer to push its unpushed changes, with `message` as the user's message. */
  onPushChanges?: (message: string) => void;
}

/** The run's PRs, pinned above the chat input so they outlive the transcript scroll. */
export function PRLinksBar({
  changes = [],
  isAgentBusy = false,
  onOpenChanges,
  onPushChanges,
  repoPRStates,
}: PRLinksBarProps) {
  const states = Object.values(repoPRStates).filter(
    state => state.pr_creation_status !== null
  );
  // Repos Seer edited without opening a PR still get a row, for their buttons.
  const changesWithoutPR =
    onOpenChanges || onPushChanges
      ? changes.filter(
          repoChanges => !states.some(state => state.repo_name === repoChanges.repoName)
        )
      : [];
  const rows = [
    ...states.map(state => ({
      repoName: state.repo_name,
      state,
      repoChanges: changes.find(candidate => candidate.repoName === state.repo_name),
    })),
    ...changesWithoutPR.map(repoChanges => ({
      repoName: repoChanges.repoName,
      state: null,
      repoChanges,
    })),
  ];
  if (rows.length === 0) {
    return null;
  }
  const hasUnpushed = (repoChanges: RepoChanges | undefined) =>
    !!repoChanges && repoChanges.unpushed.files.length > 0;
  const showPushColumn =
    !!onPushChanges && rows.some(row => hasUnpushed(row.repoChanges));

  // One grid for every row, so each column of buttons shares a position and a width.
  return (
    <Grid
      margin="lg xl 0"
      gap="sm"
      columns={['minmax(0, 1fr)', onOpenChanges && 'auto', showPushColumn && 'auto']
        .filter(Boolean)
        .join(' ')}
    >
      {rows.map(({repoName, state, repoChanges}) => (
        <Grid
          key={repoName}
          column="1 / -1"
          columns="subgrid"
          align="center"
          padding="xs xs xs md"
          radius="md"
          background="secondary"
        >
          <Container minWidth="0">
            {state ? <PRLink state={state} /> : <RepoLabel repoName={repoName} />}
          </Container>
          {repoChanges && onOpenChanges && (
            <Grid column="2">
              <ChangesButton
                changes={repoChanges}
                onClick={() => onOpenChanges(repoName)}
              />
            </Grid>
          )}
          {onPushChanges && repoChanges && hasUnpushed(repoChanges) && (
            <Grid column="-2">
              <PushChangesButton
                changes={repoChanges}
                isAgentBusy={isAgentBusy}
                onPushChanges={onPushChanges}
              />
            </Grid>
          )}
        </Grid>
      ))}
    </Grid>
  );
}

interface PushChangesButtonProps {
  changes: RepoChanges;
  isAgentBusy: boolean;
  onPushChanges: (message: string) => void;
}

/** Asks Seer to push the repo's unpushed changes, opening a PR if it doesn't have one. */
function PushChangesButton({
  changes,
  isAgentBusy,
  onPushChanges,
}: PushChangesButtonProps) {
  const hasPR = !!changes.prState?.pr_number;
  const message = hasPR
    ? t('Push your latest changes to the %s PR.', changes.repoName)
    : t('Open a PR in %s with your changes.', changes.repoName);
  const tooltip = isAgentBusy
    ? t('Seer is still working.')
    : hasPR
      ? t('Ask Seer to push its latest changes.')
      : t('Ask Seer to open a PR with its changes.');

  return (
    <Button
      size="xs"
      variant="primary"
      icon={hasPR ? <IconUpload /> : <IconPullRequest />}
      disabled={isAgentBusy}
      tooltipProps={{title: tooltip}}
      onClick={() => onPushChanges(message)}
    >
      {hasPR ? t('Update PR') : t('Create PR')}
    </Button>
  );
}

/** A repo Seer edited without opening a PR. */
function RepoLabel({repoName}: {repoName: string}) {
  return (
    <Flex align="center" gap="sm">
      <IconPullRequest size="sm" variant="muted" />
      <Text ellipsis>{repoName}</Text>
    </Flex>
  );
}

/** Status icon, then owner/repo#number, linking to the PR once there is one. */
function PRLink({state}: {state: RepoPRState}) {
  // The URL comes from session data, so only link http(s) URLs and never e.g. `javascript:`.
  const prUrl = state.pr_url && isValidUrl(state.pr_url) ? state.pr_url : null;
  const label = state.pr_number
    ? `${state.repo_name}#${state.pr_number}`
    : state.repo_name;

  let icon: React.ReactNode = <IconPullRequest size="sm" />;
  let tooltip: string | null = null;
  if (state.pr_creation_status === 'creating') {
    icon = <LoadingIndicator size={14} style={{margin: 0}} />;
    tooltip = state.pr_number ? t('Pushing changes…') : t('Opening PR…');
  } else if (state.pr_creation_status === 'error') {
    icon = <IconWarning size="sm" variant="danger" />;
    // A PR number means the PR already exists, so the failure was a push to it.
    tooltip =
      state.pr_creation_error ??
      (state.pr_number ? t('Could not push changes') : t('Could not open PR'));
  }

  return (
    <Tooltip title={tooltip} disabled={!tooltip} skipWrapper>
      <Flex align="center" gap="sm">
        {icon}
        {/* A failed push to an existing PR still links to it. */}
        {prUrl ? (
          <ExternalLink href={prUrl}>
            <Flex align="center" gap="xs">
              {label}
              <IconOpen size="xs" />
            </Flex>
          </ExternalLink>
        ) : (
          <Text ellipsis>{label}</Text>
        )}
      </Flex>
    </Tooltip>
  );
}

interface ChangesButtonProps {
  changes: RepoChanges;
  onClick: () => void;
}

/** The size of everything the run changed, opening its diff. */
function ChangesButton({changes, onClick}: ChangesButtonProps) {
  const unpushedFiles = changes.unpushed.files.length;
  const hasPR = !!changes.prState?.pr_number;

  let tooltip: string;
  if (unpushedFiles === 0) {
    tooltip = t('View changes');
  } else if (hasPR) {
    tooltip = tn(
      'View changes. %s file has changes not pushed to the PR.',
      'View changes. %s files have changes not pushed to the PR.',
      unpushedFiles
    );
  } else {
    tooltip = tn(
      'View changes. %s file is not in a PR yet.',
      'View changes. %s files are not in a PR yet.',
      unpushedFiles
    );
  }

  return (
    <Button
      size="xs"
      onClick={onClick}
      aria-label={tooltip}
      tooltipProps={{title: tooltip}}
    >
      <Flex align="center" gap="sm">
        {changes.all ? (
          <Fragment>
            {/* The button's own font: centered monospace digits sit low in the button. */}
            <Text variant="success" tabular>
              +{changes.all.added}
            </Text>
            <Text variant="danger" tabular>
              -{changes.all.removed}
            </Text>
          </Fragment>
        ) : changes.allStatus === 'pending' ? (
          <LoadingIndicator size={12} style={{margin: 0}} />
        ) : (
          t('Changes')
        )}
      </Flex>
    </Button>
  );
}
