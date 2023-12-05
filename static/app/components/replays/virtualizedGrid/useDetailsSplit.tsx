import {RefObject, useCallback} from 'react';

import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';

interface OnClickProps {
  dataIndex: number;
  rowIndex: number;
}

interface Props {
  containerRef: RefObject<HTMLDivElement>;
  frames: undefined | ReadonlyArray<unknown>;
  handleHeight: number;
  urlParamName: string;
  onHideDetails?: () => void;
  onShowDetails?: (props: OnClickProps) => void;
}

export default function useDetailsSplit({
  containerRef,
  frames,
  handleHeight,
  onHideDetails,
  onShowDetails,
  urlParamName,
}: Props) {
  const {getParamValue: getDetailIndex, setParamValue: setDetailIndex} = useUrlParams(
    urlParamName,
    ''
  );

  const onClickCell = useCallback(
    ({dataIndex, rowIndex}: OnClickProps) => {
      if (getDetailIndex() === String(dataIndex)) {
        setDetailIndex('');
        onHideDetails?.();
      } else {
        setDetailIndex(String(dataIndex));
        onShowDetails?.({dataIndex, rowIndex});
      }
    },
    [getDetailIndex, setDetailIndex, onHideDetails, onShowDetails]
  );

  const onCloseDetailsSplit = useCallback(() => {
    setDetailIndex('');
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
    frames && getDetailIndex() ? Math.min(maxContainerHeight, containerSize) : undefined;

  return {
    onClickCell,
    onCloseDetailsSplit,
    resizableDrawerProps,
    selectedIndex: getDetailIndex(),
    splitSize,
  };
}
