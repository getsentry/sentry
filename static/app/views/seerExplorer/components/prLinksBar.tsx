import {IconPullRequest} from '@sentry/icons/pullRequest';
import {IconWarning} from '@sentry/icons/warning';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

interface PRLinksBarProps {
  repoPRStates: Record<string, RepoPRState>;
}

/** The run's PRs, pinned above the chat input so they outlive the transcript scroll. */
export function PRLinksBar({repoPRStates}: PRLinksBarProps) {
  const states = Object.values(repoPRStates).filter(
    state => state.pr_creation_status !== null
  );
  if (states.length === 0) {
    return null;
  }

  return (
    <Flex margin="lg xl 0" gap="md" wrap="wrap">
      {states.map(state => (
        <PRButton key={state.repo_name} state={state} />
      ))}
    </Flex>
  );
}

/** Styled like the autofix evidence buttons: status icon, then owner/repo#number. */
function PRButton({state}: {state: RepoPRState}) {
  // The URL comes from session data, so only link http(s) URLs and never e.g. `javascript:`.
  const prUrl = state.pr_url && isValidUrl(state.pr_url) ? state.pr_url : null;
  const label = state.pr_number
    ? `${state.repo_name}#${state.pr_number}`
    : state.repo_name;

  if (state.pr_creation_status === 'creating') {
    return (
      <Button
        disabled
        size="sm"
        icon={<LoadingIndicator size={16} style={{margin: 0}} />}
        tooltipProps={{
          title: state.pr_number ? t('Pushing changes…') : t('Opening PR…'),
        }}
      >
        {label}
      </Button>
    );
  }

  const isError = state.pr_creation_status === 'error';
  const icon = isError ? <IconWarning variant="danger" /> : <IconPullRequest />;
  const tooltipProps = isError
    ? {
        // A PR number means the PR already exists, so the failure was a push to it.
        title:
          state.pr_creation_error ??
          (state.pr_number ? t('Could not push changes') : t('Could not open PR')),
      }
    : undefined;

  // A failed push to an existing PR still links to it.
  if (prUrl) {
    return (
      <LinkButton href={prUrl} external size="sm" icon={icon} tooltipProps={tooltipProps}>
        {label}
      </LinkButton>
    );
  }

  return (
    <Button disabled size="sm" icon={icon} tooltipProps={tooltipProps}>
      {label}
    </Button>
  );
}
