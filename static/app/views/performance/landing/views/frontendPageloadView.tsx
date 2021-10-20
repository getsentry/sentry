import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';
import {FRONTEND_PAGELOAD_COLUMN_TITLES} from '../data';

import {BasePerformanceViewProps} from './types';

export function FrontendPageloadView(props: BasePerformanceViewProps) {
  return (
    <div data-test-id="frontend-pageload-view">
      <Table
        {...props}
        columnTitles={FRONTEND_PAGELOAD_COLUMN_TITLES}
        setError={usePageError().setPageError}
      />
    </div>
  );
}
