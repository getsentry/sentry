import {usePageError} from '../../contexts/pageError';
import Table from '../../table';
import {FRONTEND_PAGELOAD_COLUMN_TITLES} from '../data';
import MiniChartRow from '../widgets/miniChartRow';

import {BasePerformanceViewProps} from './types';

export function FrontendPageloadView(props: BasePerformanceViewProps) {
  return (
    <div data-test-id="frontend-pageload-view">
      <MiniChartRow {...props} />

      <Table
        {...props}
        columnTitles={FRONTEND_PAGELOAD_COLUMN_TITLES}
        setError={usePageError().setPageError}
        summaryConditions={props.eventView.getQueryWithAdditionalConditions()}
      />
    </div>
  );
}
