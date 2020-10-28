import React from 'react';
import xor from 'lodash/xor';
import uniq from 'lodash/uniq';
import intersection from 'lodash/intersection';

import BulkNotice from './bulkNotice';

type RenderProps = {
  /**
   * Are all rows on current page selected?
   */
  isPageSelected: boolean;
  /**
   * Callback for toggling single row
   */
  onRowToggle: (id: string) => void;
  /**
   * Callback for toggling all rows across all pages
   */
  onAllRowsToggle: (select: boolean) => void;
  /**
   * Callback for toggling all rows on current page
   */
  onPageRowsToggle: (select: boolean) => void;
  /**
   * Ready to be rendered summary component showing how many items are selected,
   * with buttons to select everything, cancel everything, etc...
   */
  renderBulkNotice: () => React.ReactNode;
} & Pick<State, 'selectedIds' | 'isAllSelected'>;

type State = {
  /**
   * Selected ids on the current page
   */
  selectedIds: string[];
  /**
   * Are all rows across all pages selected?
   */
  isAllSelected: boolean;
};

type Props = {
  /**
   * Array of ids on current page
   */
  pageIds: string[];
  /**
   * Number of all rows across all pages
   */
  allRowsCount: number;
  /**
   * Number of grid columns to stretch the selection summary (used in BulkNotice)
   */
  columnsCount: number;
  /**
   * Children with render props
   */
  children: (props: RenderProps) => React.ReactNode;
  /**
   * Maximum number of rows that can be bulk manipulated at once (used in BulkNotice)
   */
  bulkLimit?: number;
};

class BulkController extends React.Component<Props, State> {
  state: State = {
    selectedIds: [],
    isAllSelected: false,
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      selectedIds: intersection(state.selectedIds, props.pageIds),
    };
  }

  handleRowToggle = (id: string) => {
    this.setState(state => ({
      selectedIds: xor(state.selectedIds, [id]),
      isAllSelected: false,
    }));
  };

  handleAllRowsToggle = (select: boolean) => {
    const {pageIds} = this.props;
    this.setState({
      selectedIds: select ? [...pageIds] : [],
      isAllSelected: select,
    });
  };

  handlePageRowsToggle = (select: boolean) => {
    const {pageIds} = this.props;
    this.setState(state => ({
      selectedIds: select
        ? uniq([...state.selectedIds, ...pageIds])
        : state.selectedIds.filter(id => !pageIds.includes(id)),
      isAllSelected: false,
    }));
  };

  render() {
    const {pageIds, children, columnsCount, allRowsCount, bulkLimit} = this.props;
    const {selectedIds, isAllSelected} = this.state;

    const isPageSelected =
      pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));

    const renderProps: RenderProps = {
      selectedIds,
      isAllSelected,
      isPageSelected,
      onRowToggle: this.handleRowToggle,
      onAllRowsToggle: this.handleAllRowsToggle,
      onPageRowsToggle: this.handlePageRowsToggle,
      renderBulkNotice: () => (
        <BulkNotice
          allRowsCount={allRowsCount}
          selectedRowsCount={selectedIds.length}
          onUnselectAllRows={() => this.handleAllRowsToggle(false)}
          onSelectAllRows={() => this.handleAllRowsToggle(true)}
          columnsCount={columnsCount}
          isPageSelected={isPageSelected}
          isAllSelected={isAllSelected}
          bulkLimit={bulkLimit}
        />
      ),
    };

    return children(renderProps);
  }
}

export default BulkController;
