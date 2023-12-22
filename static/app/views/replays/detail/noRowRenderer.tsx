import {ReactNode} from 'react';

import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import EmptyState from 'sentry/views/replays/detail/emptyState';

type Props = {
  children: ReactNode;
  clearSearchTerm: () => void;
  unfilteredItems: unknown[];
};

function NoRowRenderer({children, unfilteredItems, clearSearchTerm}: Props) {
  return unfilteredItems.length === 0 ? (
    <EmptyState>
      <p>{children}</p>
    </EmptyState>
  ) : (
    <EmptyState>
      <p>{t('No results found')}</p>
      <Button icon={<IconClose color="gray500" isCircled />} onClick={clearSearchTerm}>
        {t('Clear filters')}
      </Button>
    </EmptyState>
  );
}

export default NoRowRenderer;
