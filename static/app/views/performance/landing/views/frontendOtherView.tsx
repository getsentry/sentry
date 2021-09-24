import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';
import {FRONTEND_OTHER_COLUMN_TITLES} from '../data';

import {BasePerformanceViewProps} from './types';

export function FrontendOtherView(props: BasePerformanceViewProps) {
  return (
    <div>
      <Table
        {...props}
        columnTitles={FRONTEND_OTHER_COLUMN_TITLES}
        setError={usePageError().setPageError}
      />
    </div>
  );
}
