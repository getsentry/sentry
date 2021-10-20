import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';
import {MOBILE_COLUMN_TITLES} from '../data';

import {BasePerformanceViewProps} from './types';

export function MobileView(props: BasePerformanceViewProps) {
  return (
    <div>
      <Table
        {...props}
        columnTitles={MOBILE_COLUMN_TITLES} // TODO(k-fish): Add react native column titles
        setError={usePageError().setPageError}
      />
    </div>
  );
}
