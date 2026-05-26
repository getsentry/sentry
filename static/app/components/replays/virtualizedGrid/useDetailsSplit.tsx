import type {RefObject} from 'react';
import {useCallback} from 'react';
import {parseAsInteger, useQueryState} from 'nuqs';

import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

interface OnClickProps {
  dataIndex: number;
  rowIndex: number;
}

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  frames: undefined | readonly unknown[];
  handleHeight: number;
  urlParamName: string;
  onHideDetails?: () => void;
  onShowDetails?: (props: OnClickProps) => void;
}

export function useDetailsSplit({
  containerRef,
  frames,
  handleHeight,
  onHideDetails,
  onShowDetails,
  urlParamName,
}: Props) {
  const [detailIndex, setDetailIndex] = useQueryState(urlParamName, parseAsInteger);

  const onClickCell = useCallback(
    ({dataIndex, rowIndex}: OnClickProps) => {
      if (detailIndex === dataIndex) {
        setDetailIndex(null);
        onHideDetails?.();
      } else {
        setDetailIndex(dataIndex);
        onShowDetails?.({dataIndex, rowIndex});
      }
    },
    [detailIndex, setDetailIndex, onHideDetails, onShowDetails]
  );

  const onCloseDetailsSplit = useCallback(() => {
    setDetailIndex(null);
    onHideDetails?.();
  }, [setDetailIndex, onHideDetails]);

  // `initialSize` cannot depend on containerRef because the ref starts as
  // `undefined` which then gets set into the hook and doesn't update.
  const initialSize = Math.max(150, window.innerHeight * 0.4);

  const {size: containerSize, ...resizableDrawerProps} = useResizableDrawer({
    direction: 'up',
    initialSize,
    min: 0,
    onResize: () => {},
  });

  const maxContainerHeight =
    (containerRef.current?.clientHeight || window.innerHeight) - handleHeight;
  const splitSize =
    frames && detailIndex !== null
      ? Math.min(maxContainerHeight, containerSize)
      : undefined;

  return {
    onClickCell,
    onCloseDetailsSplit,
    resizableDrawerProps,
    selectedIndex: detailIndex,
    splitSize,
  };
}
