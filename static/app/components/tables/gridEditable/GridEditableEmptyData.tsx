import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';

import {GridBodyCellStatus, GridRow} from './styles';

type Props = {
  emptyMessage: React.ReactNode;
};

export function GridEditableEmptyData({emptyMessage}: Props) {
  return (
    <GridRow>
      <GridBodyCellStatus>
        {emptyMessage ?? (
          <EmptyStateWarning>
            <p>{t('No results found for your query')}</p>
          </EmptyStateWarning>
        )}
      </GridBodyCellStatus>
    </GridRow>
  );
}
