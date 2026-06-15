import type {ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {StyledEmptyStateWarning as EmptyState} from 'sentry/views/explore/replays/detail/emptyState';

type Props = {
  children: ReactNode;
  clearSearchTerm: () => void;
  unfilteredItems: unknown[];
  hasUnfilteredItems?: boolean;
};

export function NoRowRenderer({
  children,
  unfilteredItems,
  hasUnfilteredItems,
  clearSearchTerm,
}: Props) {
  const itemsExist = hasUnfilteredItems ?? unfilteredItems.length > 0;

  return itemsExist ? (
    <EmptyState>
      <p>{t('No results found')}</p>
      <Button icon={<IconClose variant="primary" />} onClick={clearSearchTerm}>
        {t('Clear filters')}
      </Button>
    </EmptyState>
  ) : (
    <EmptyState>
      <p>{children}</p>
    </EmptyState>
  );
}
