import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
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
    ? {title: state.pr_creation_error ?? t('Could not open PR')}
    : undefined;

  // A failed push to an existing PR still links to it.
  if (state.pr_url) {
    return (
      <LinkButton
        href={state.pr_url}
        external
        size="sm"
        icon={icon}
        tooltipProps={tooltipProps}
      >
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
