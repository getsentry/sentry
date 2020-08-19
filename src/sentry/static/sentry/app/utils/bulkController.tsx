import React from 'react';
import xor from 'lodash/xor';
import uniq from 'lodash/uniq';
import intersection from 'lodash/intersection';

export type RenderProps = {
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
    const {pageIds, children} = this.props;
    const {selectedIds, isEverythingSelected} = this.state;

    const renderProps = {
      selectedIds,
      isEverythingSelected,
      isPageSelected: pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id)),
      onIdToggle: this.handleIdToggle,
      onAllIdsToggle: this.handleAllIdsToggle,
      onPageIdsToggle: this.handlePageIdsToggle,
    };

    return children(renderProps);
  }
}

export default BulkController;
