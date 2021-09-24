import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';

import {BasePerformanceViewProps} from './types';

export function AllTransactionsView(props: BasePerformanceViewProps) {
  return (
    <div>
      <Table {...props} setError={usePageError().setPageError} />
    </div>
  );
}
