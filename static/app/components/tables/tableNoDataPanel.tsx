import styled from '@emotion/styled';

import {EmptyState} from '@sentry/scraps/emptyState';

import {t} from 'sentry/locale';

export function TableNoDataPanel() {
  return (
    <TableEmptyState
      title={t('No results found')}
      description={t('Try adjusting the filters.')}
    />
  );
}

const TableEmptyState = styled(EmptyState)`
  /* Legacy PanelBody text margins must not add to the empty state's gap. */
  && h3,
  && p {
    margin: 0;
  }
`;
