import * as React from 'react';

import {Organization, ReleaseProject} from 'app/types';

import PerformanceCardTable from './performanceCardTable';

const DEFAULT_TRANSACTION_LIMIT = 5;

type Props = {
  organization: Organization;
  project: ReleaseProject;
  /**
   * The limit to the number of results to fetch.
   */
  limit: number;
  /**
   * Show a loading indicator instead of the table, used for transaction summary p95.
   */
  forceLoading?: boolean;
};

class PerformanceCardList extends React.Component<Props> {
  static defaultProps = {
    cursorName: 'transactionCursor',
    limit: DEFAULT_TRANSACTION_LIMIT,
  };

  renderTransactionTable(): React.ReactNode {
    const {organization, project} = this.props;

    return (
      <React.Fragment>
        <PerformanceCardTable organization={organization} project={project} />
      </React.Fragment>
    );
  }

  render() {
    return <React.Fragment>{this.renderTransactionTable()}</React.Fragment>;
  }
}

export default PerformanceCardList;
