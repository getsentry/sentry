import React from 'react';

import Button from 'app/components/button';
import {t, tn} from 'app/locale';

type CollapseButtonRenderProps = {
  handleCollapse: () => void;
};

type ExpandButtonRenderProps = {
  handleExpand: () => void;
  numberOfCollapsedItems: number;
};

type DefaultProps = {
  maxVisibleItems: number;
};

type Props = {
  collapseButton?: (props: CollapseButtonRenderProps) => React.ReactNode;
  expandButton?: (props: ExpandButtonRenderProps) => React.ReactNode;
} & DefaultProps;

type State = {
  collapsed: boolean;
};

class Collapsible extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    maxVisibleItems: 5,
  };

  state: State = {
    collapsed: true,
  };

  onCollapseToggle = () => {
    this.setState(prevState => ({
      collapsed: !prevState.collapsed,
    }));
  };

  renderCollapseButton() {
    const {collapseButton} = this.props;

    if (typeof collapseButton === 'function') {
      return collapseButton({handleCollapse: this.onCollapseToggle});
    }

    return (
      <Button priority="link" onClick={this.onCollapseToggle} data-test-id="collapse">
        {t('Collapse')}
      </Button>
    );
  }

  renderExpandButton(numberOfCollapsedItems: number) {
    const {expandButton} = this.props;

    if (typeof expandButton === 'function') {
      return expandButton({
        handleExpand: this.onCollapseToggle,
        numberOfCollapsedItems,
      });
    }

    return (
      <Button priority="link" onClick={this.onCollapseToggle} data-test-id="expand">
        {tn('Show %s collapsed item', 'Show %s collapsed items', numberOfCollapsedItems)}
      </Button>
    );
  }

  render() {
    const {maxVisibleItems, children} = this.props;
    const {collapsed} = this.state;

    const items = React.Children.toArray(children);
    const canExpand = items.length > maxVisibleItems;
    const itemsToRender =
      collapsed && canExpand ? items.slice(0, maxVisibleItems) : items;
    const numberOfCollapsedItems = items.length - itemsToRender.length;

    return (
      <React.Fragment>
        {itemsToRender.map(item => item)}

        {numberOfCollapsedItems > 0 && this.renderExpandButton(numberOfCollapsedItems)}

        {numberOfCollapsedItems === 0 && canExpand && this.renderCollapseButton()}
      </React.Fragment>
    );
  }
}

export default Collapsible;
