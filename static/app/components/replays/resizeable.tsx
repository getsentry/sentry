import React, {useCallback, useRef, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

type Dimensions = {height: number; width: number};

type Props = {
  children: (props: Dimensions) => React.ReactElement | null;
  className?: string;
};

/**
 * Watch and pass element dimensions into child render function.
 *
 * WARNING: be careful not to update the dimensions of child elements based on
 * this parent size as that could cause infinite render loops
 */
export function Resizeable({children, className}: Props) {
  const el = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState({height: 0, width: 0});

  const onResize = useCallback(() => {
    setDimensions({
      height: el.current?.clientHeight || 0,
      width: el.current?.clientWidth || 0,
    });
  }, [setDimensions]);

  useResizeObserver({ref: el, onResize});

  return (
    <div className={className} ref={el}>
      {children(dimensions)}
    </div>
  );
}
