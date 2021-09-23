import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';
import {BACKEND_COLUMN_TITLES} from '../data';

import {BasePerformanceViewProps} from './types';

export function BackendView(props: BasePerformanceViewProps) {
  return (
    <div>
      <Table
        {...props}
        columnTitles={BACKEND_COLUMN_TITLES}
        setError={usePageError().setPageError}
      />
    </div>
  );
}
