import type {Ref} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ScmMessagingResolvedProvider} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconEdit} from 'sentry/icons/iconEdit';
import {t} from 'sentry/locale';

import type {RowVisualState} from './types';

interface RowActionsProps {
  /**
   * The first control of each state. The row moves focus here when a state
   * change unmounts the control that was activated.
   */
  focusRef: Ref<HTMLButtonElement>;
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
  focusRef,
  onConnect,
  onChooseDestination,
  onEditDestination,
  onStartRemoving,
  onCancelRemoving,
  onConfirmRemove,
}: RowActionsProps) {
  if (visualState === 'loading' || visualState === 'installing') {
    return (
      <Flex
        justify="center"
        align="center"
        style={{minWidth: 88}}
        role="status"
        aria-label={t('Connecting %s', resolvedProvider.provider.name)}
      >
        <LoadingIndicator mini style={{margin: 0}} />
      </Flex>
    );
  }

  if (visualState === 'installable') {
    return (
      <Button
        ref={focusRef}
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
        ref={focusRef}
        size="sm"
        icon={<IconAdd size="xs" />}
        onClick={onChooseDestination}
        aria-label={t('Set up %s', resolvedProvider.provider.name)}
      >
        {t('Set up')}
      </Button>
    );
  }

  if (visualState === 'configured') {
    return (
      <Flex gap="xl">
        <Button
          ref={focusRef}
          size="sm"
          icon={<IconEdit size="xs" />}
          onClick={onEditDestination}
          aria-label={t('Edit %s destination', resolvedProvider.provider.name)}
        >
          {t('Edit')}
        </Button>
        <Button
          size="sm"
          icon={<IconDelete size="xs" />}
          onClick={onStartRemoving}
          aria-label={t('Remove %s destination', resolvedProvider.provider.name)}
        >
          {t('Remove')}
        </Button>
      </Flex>
    );
  }

  if (visualState === 'removing') {
    return (
      <Flex gap="xl">
        <Button ref={focusRef} size="sm" variant="transparent" onClick={onCancelRemoving}>
          {t('Cancel')}
        </Button>
        <Button size="sm" variant="danger" onClick={onConfirmRemove}>
          {t('Remove')}
        </Button>
      </Flex>
    );
  }

  return null;
}
