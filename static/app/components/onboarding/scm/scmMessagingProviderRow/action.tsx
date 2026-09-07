import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ScmMessagingResolvedProvider} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';

import type {RowVisualState} from './types';

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
