import {t} from 'sentry/locale';

import type {DashboardTableProps} from './table';
import {DashboardTable} from './table';

export const OWNED_CURSOR_KEY = 'ownedCursor';

function DashboardsOwnedTable({
  dashboards,
  isLoading,
  pageLinks,
}: Pick<DashboardTableProps, 'dashboards' | 'isLoading' | 'pageLinks'>) {
  return (
    <DashboardTable
      title={t('Created by Me')}
      cursorKey={OWNED_CURSOR_KEY}
      dashboards={dashboards}
      isLoading={isLoading}
      pageLinks={pageLinks}
    />
  );
}

export default DashboardsOwnedTable;
