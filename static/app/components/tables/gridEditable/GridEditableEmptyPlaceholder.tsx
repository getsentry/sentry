import type {ReactNode} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';

type Props = {
  emptyMessage?: ReactNode;
};

/**
 * Flex-based empty state for `GridEditable`. Swapped in under an empty header shell
 * when there are no rows; parent (`GridBodyCellStatus`) supplies vertical space.
 */
export function GridEditableEmptyPlaceholder({emptyMessage}: Props) {
  return (
    <Flex
      data-test-id="grid-editable-empty-placeholder"
      direction="column"
      align="center"
      justify="center"
      width="100%"
      minWidth={0}
      maxWidth="100%"
      overflow="hidden"
    >
      {emptyMessage ?? (
        <EmptyStateWarning>
          <p>{t('No results found for your query')}</p>
        </EmptyStateWarning>
      )}
    </Flex>
  );
}
