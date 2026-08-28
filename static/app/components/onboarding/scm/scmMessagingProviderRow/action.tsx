import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ScmMessagingResolvedProvider} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';

/**
 * The visual state of a single provider row. Derived from the resolved provider,
 * the install-flow state machine, and the current messaging setup in session
 * storage.
 */
export type RowVisualState =
  | 'installable'
  /**
   * User lacks org:integrations so they cannot start an installation.
   * Distinct from 'permission-limited', which describes a tenant-level MS Teams
   * integration that is ineligible for Issue Alert actions regardless of user scope.
   */
  | 'install-forbidden'
  /** OAuth modal is open / install in progress. */
  | 'installing'
  /** Install attempt ended with an error (or was closed after one). */
  | 'install-error'
  /** Install confirmed; waiting for the integrations query to re-settle. */
  | 'loading'
  /** Active integration exists but is ineligible for Issue Alert actions. */
  | 'permission-limited'
  /**
   * Integration is connected but no destination has been saved yet, and the
   * user has not explicitly opened the picker.
   */
  | 'choose-destination'
  /** Destination is being configured (channel picker rendered inline). */
  | 'configuring'
  /** A destination has been saved to session state. */
  | 'configured'
  /** User is confirming a destination removal. */
  | 'removing';

interface RowActionsProps {
  onCancelRemoving: () => void;
  onChooseDestination: () => void;
  onConfirmRemove: () => void;
  onConnect: () => void;
  onEditDestination: () => void;
  onStartRemoving: () => void;
  resolvedProvider: ScmMessagingResolvedProvider;
  visualState: RowVisualState;
}

export function RowActions({
  visualState,
  resolvedProvider,
  onConnect,
  onChooseDestination,
  onEditDestination,
  onStartRemoving,
  onCancelRemoving,
  onConfirmRemove,
}: RowActionsProps) {
  if (visualState === 'loading' || visualState === 'installing') {
    return (
      <Flex justify="center" align="center" style={{minWidth: 88}}>
        <LoadingIndicator mini style={{margin: 0}} />
      </Flex>
    );
  }

  if (visualState === 'installable') {
    return (
      <Button
        size="sm"
        icon={<IconAdd size="xs" />}
        onClick={onConnect}
        aria-label={t('Connect %s', resolvedProvider.provider.name)}
      >
        {t('Connect')}
      </Button>
    );
  }

  if (visualState === 'install-forbidden') {
    return (
      <Button
        size="sm"
        disabled
        aria-label={t('Connect %s', resolvedProvider.provider.name)}
      >
        {t('Connect')}
      </Button>
    );
  }

  if (visualState === 'permission-limited') {
    return (
      <Button size="sm" disabled>
        {t('Connect')}
      </Button>
    );
  }

  if (visualState === 'choose-destination') {
    return (
      <Button
        size="sm"
        icon={<IconAdd size="xs" />}
        onClick={onChooseDestination}
        aria-label={t('Choose destination for %s', resolvedProvider.provider.name)}
      >
        {t('Choose destination')}
      </Button>
    );
  }

  if (visualState === 'configured') {
    return (
      <Fragment>
        <Button size="sm" variant="link" onClick={onEditDestination}>
          {t('Edit')}
        </Button>
        <Button size="sm" variant="link" onClick={onStartRemoving}>
          {t('Remove')}
        </Button>
      </Fragment>
    );
  }

  if (visualState === 'removing') {
    return (
      <Fragment>
        <Button size="sm" variant="link" onClick={onCancelRemoving}>
          {t('Cancel')}
        </Button>
        <Button size="sm" variant="danger" onClick={onConfirmRemove}>
          {t('Remove')}
        </Button>
      </Fragment>
    );
  }

  return null;
}
