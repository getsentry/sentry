import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Theme} from 'app/utils/theme';

export const layout = (theme: Theme) => `
> * {
  ${overflowEllipsis};

  :nth-child(-n + 5):nth-child(5n - 1) {
    text-align: center;
  }

  :nth-child(5n) {
    overflow: visible;
  }

  @media (max-width: ${theme.breakpoints[0]}) {
    :nth-child(5n - 4),
    :nth-child(5n - 3) {
      display: none;
    }
  }
}

grid-template-columns: 2fr 1.5fr 1fr;

@media (min-width: ${theme.breakpoints[0]}) {
  grid-template-columns: 0.5fr 1.5fr 2fr 1.5fr 1fr;
}

@media (min-width: ${theme.breakpoints[2]}) {
  grid-template-columns: 0.5fr 2fr 2.5fr 2fr 1.5fr;
}

@media (min-width: ${theme.breakpoints[3]}) {
  grid-template-columns: 0.5fr 2fr 3fr 2fr 1fr;
}
`;

const queryAttr = 'data-rbd-draggable-id';

export function getDraggedDom(draggableId: string) {
  const domQuery = `[${queryAttr}='${draggableId}']`;
  const draggedDOM = document.querySelector(domQuery);

  return draggedDOM;
}

export function getClientY<T>(
  domParentNode: Element,
  destinationIndex: number,
  childrenArray?: Array<T>
) {
  return (
    parseFloat(window.getComputedStyle(domParentNode).paddingTop) +
    (childrenArray ?? [...(domParentNode.children as any)])
      .slice(0, destinationIndex)
      .reduce((total, curr) => {
        const style = curr?.currentStyle || window.getComputedStyle(curr);
        const marginBottom = parseFloat(style.marginBottom);
        return total + curr.clientHeight + marginBottom;
      }, 0)
  );
}
