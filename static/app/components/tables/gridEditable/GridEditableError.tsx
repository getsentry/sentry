import {IconWarning} from 'sentry/icons';

import {GridBodyCellStatus, GridRow} from './styles';

export function GridEditableError() {
  return (
    <GridRow>
      <GridBodyCellStatus>
        <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
      </GridBodyCellStatus>
    </GridRow>
  );
}
