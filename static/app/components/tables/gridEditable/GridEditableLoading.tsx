import LoadingIndicator from 'sentry/components/loadingIndicator';

import {GridBodyCellStatus, GridRow} from './styles';

export function GridEditableLoading() {
  return (
    <GridRow>
      <GridBodyCellStatus>
        <LoadingIndicator />
      </GridBodyCellStatus>
    </GridRow>
  );
}
