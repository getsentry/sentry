import React from 'react';
import xor from 'lodash/xor';
import uniq from 'lodash/uniq';

export type RenderProps = {
  allIdsSelected: boolean;
  pageIdsSelected: boolean;
  onIdToggle: (id: string) => void;
  onAllIdsToggle: (select: boolean) => void;
  onPageIdsToggle: (select: boolean) => void;
} & Pick<State, 'selectedIds'>;

type State = {
  /**
   * Currently selected ids across pages
   */
  selectedIds: string[];
};

type Props = {
  /**
   * Array of all ids across pagination pages
   */
  allIds: string[];
  /**
   * Array of ids on current page
   */
  pageIds: string[];
  children: (props: RenderProps) => React.ReactNode;
};

class BulkController extends React.Component<Props, State> {
  state: State = {
    selectedIds: [],
  };

  handleIdToggle = (id: string) => {
    this.setState(state => ({
      selectedIds: xor(state.selectedIds, [id]),
    }));
  };
  handleAllIdsToggle = (select: boolean) => {
    const {allIds} = this.props;
    this.setState({selectedIds: select ? [...allIds] : []});
  };
  handlePageIdsToggle = (select: boolean) => {
    const {pageIds} = this.props;
    this.setState(state => ({
      selectedIds: select
        ? uniq([...state.selectedIds, ...pageIds])
        : state.selectedIds.filter(id => !pageIds.includes(id)),
    }));
  };

  render() {
    const {pageIds, allIds, children} = this.props;
    const {selectedIds} = this.state;

    const renderProps = {
      selectedIds,
      allIdsSelected: allIds.length > 0 && allIds.every(id => selectedIds.includes(id)),
      pageIdsSelected:
        pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id)),
      onIdToggle: this.handleIdToggle,
      onAllIdsToggle: this.handleAllIdsToggle,
      onPageIdsToggle: this.handlePageIdsToggle,
    };

    return children(renderProps);
  }
}

export default BulkController;
