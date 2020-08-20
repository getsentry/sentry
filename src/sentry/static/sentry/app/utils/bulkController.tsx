import React from 'react';
import xor from 'lodash/xor';
import uniq from 'lodash/uniq';
import intersection from 'lodash/intersection';

import BulkNotice from 'app/components/bulkNotice';

type RenderProps = {
  /**
   * Are all rows on current page selected?
   */
  isPageSelected: boolean;
  /**
   * Callback for toggling single row
   */
  onIdToggle: (id: string) => void;
  /**
   * Callback for toggling all rows across all pages
   */
  onAllIdsToggle: (select: boolean) => void;
  /**
   * Callback for toggling all rows on current page
   */
  onPageIdsToggle: (select: boolean) => void;
  /**
   * Ready to be rendered summary component showing how many items are selected,
   * with buttons to select everything, cancel everything, etc...
   */
  bulkNotice: React.ReactNode;
} & Pick<State, 'selectedIds' | 'isEverythingSelected'>;

type State = {
  /**
   * Selected ids on the current page
   */
  selectedIds: string[];
  /**
   * Are all rows across all pages selected?
   */
  isEverythingSelected: boolean;
};

type Props = {
  /**
   * Array of ids on current page
   */
  pageIds: string[];
  /**
   * Number of all rows across all pages
   */
  allIdsCount: number;
  /**
   * Number of grid columns to stretch the selection summary (used in BulkNotice)
   */
  noticeColumns: number;
  children: (props: RenderProps) => React.ReactNode;
};

class BulkController extends React.Component<Props, State> {
  state: State = {
    selectedIds: [],
    isEverythingSelected: false,
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    return {
      ...state,
      selectedIds: intersection(state.selectedIds, props.pageIds),
    };
  }

  handleIdToggle = (id: string) => {
    this.setState(state => ({
      selectedIds: xor(state.selectedIds, [id]),
      isEverythingSelected: false,
    }));
  };
  handleAllIdsToggle = (select: boolean) => {
    const {pageIds} = this.props;
    this.setState({
      selectedIds: select ? [...pageIds] : [],
      isEverythingSelected: select,
    });
  };
  handlePageIdsToggle = (select: boolean) => {
    const {pageIds} = this.props;
    this.setState(state => ({
      selectedIds: select
        ? uniq([...state.selectedIds, ...pageIds])
        : state.selectedIds.filter(id => !pageIds.includes(id)),
      isEverythingSelected: false,
    }));
  };

  render() {
    const {pageIds, children, noticeColumns, allIdsCount} = this.props;
    const {selectedIds, isEverythingSelected} = this.state;

    const isPageSelected =
      pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));

    const renderProps: RenderProps = {
      selectedIds,
      isEverythingSelected,
      isPageSelected,
      onIdToggle: this.handleIdToggle,
      onAllIdsToggle: this.handleAllIdsToggle,
      onPageIdsToggle: this.handlePageIdsToggle,
      bulkNotice: (
        <BulkNotice
          allRowsCount={allIdsCount}
          selectedRowsCount={selectedIds.length}
          onCancelAllRows={() => this.handleAllIdsToggle(false)}
          onSelectAllRows={() => this.handleAllIdsToggle(true)}
          columnsCount={noticeColumns}
          isPageSelected={isPageSelected}
          isEverythingSelected={isEverythingSelected}
        />
      ),
    };

    return children(renderProps);
  }
}

export default BulkController;
