import BaseResizePanel from 'react-resize-panel';
import styled from '@emotion/styled';

type Props = {
  direction: 'n' | 'e' | 's' | 'w';
  minHeight?: number;
  minWidth?: number;
  modifierClass?: string;
};

export const CLASSNAMES = {
  bar: {
    height: 'resizeHeightBar',
    width: 'resizeWidthBar',
  },
  handle: {
    height: 'resizeHeightHandle',
    width: 'resizeWidthHandle',
  },
};

const ResizePanel = styled(function ResizePanelContent({
  direction,
  modifierClass = '',
  ...props
}: Props) {
  const movesUpDown = ['n', 's'].includes(direction);
  const borderClass = movesUpDown ? CLASSNAMES.bar.height : CLASSNAMES.bar.width;
  const handleClass = movesUpDown ? CLASSNAMES.handle.height : CLASSNAMES.handle.width;

  return (
    <BaseResizePanel
      direction={direction}
      {...props}
      borderClass={`${borderClass} ${modifierClass}`}
      handleClass={`${handleClass} ${modifierClass}`}
    />
  );
})`
  position: relative;
`;

export default ResizePanel;
