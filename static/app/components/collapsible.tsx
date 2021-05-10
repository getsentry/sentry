import * as React from 'react';

import Button from 'app/components/button';
import {t, tn} from 'app/locale';

type CollapseButtonRenderProps = {
  onCollapse: () => void;
};

type ExpandButtonRenderProps = {
  onExpand: () => void;
  numberOfHiddenItems: number;
};

type Props = {
  maxVisibleItems?: number;
  collapseButton?: (props: CollapseButtonRenderProps) => React.ReactNode;
  expandButton?: (props: ExpandButtonRenderProps) => React.ReactNode;
};

/**
 * This component is used to show first X items and collapse the rest
 */
const Collapsible: React.FC<Props> = ({
  collapseButton,
  expandButton,
  maxVisibleItems = 5,
  children,
}) => {
  const [isCollapsed, setCollapsed] = React.useState(true);
  const handleCollapseToggle = () => setCollapsed(!isCollapsed);

  const items = React.Children.toArray(children);
  const canCollapse = items.length > maxVisibleItems;

  if (!canCollapse) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  const visibleItems = isCollapsed ? items.slice(0, maxVisibleItems) : items;
  const numberOfHiddenItems = items.length - visibleItems.length;

  const showDefault =
    (numberOfHiddenItems > 0 && !expandButton) ||
    (numberOfHiddenItems === 0 && !collapseButton);

  return (
    <React.Fragment>
      {visibleItems}

      {showDefault && (
        <Button priority="link" onClick={handleCollapseToggle}>
          {isCollapsed
            ? tn('Show %s hidden item', 'Show %s hidden items', numberOfHiddenItems)
            : t('Collapse')}
        </Button>
      )}

      {numberOfHiddenItems > 0 &&
        expandButton?.({onExpand: handleCollapseToggle, numberOfHiddenItems})}
      {numberOfHiddenItems === 0 && collapseButton?.({onCollapse: handleCollapseToggle})}
    </React.Fragment>
  );
};

export default Collapsible;
