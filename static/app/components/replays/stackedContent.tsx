import React, {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

type Dimensions = {height: number; width: number};

type Props = {
  children: (props: Dimensions) => React.ReactElement | null;
};

/**
 * Overlap rows of content on top of each other using grid.
 * Similar to how `posisition: absolute;` could force content to be on-top of
 * each other, but this does so without taking the content out of the page flow.
 *
 * Injest the width/height of the container, so children can adjust and expand
 * to fill the whole area.
 */
function StackedContent({children}: Props) {
  const el = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState({height: 0, width: 0});

  const onResize = useCallback(() => {
    setDimensions({
      height: el.current?.clientHeight || 0,
      width: el.current?.clientWidth || 0,
    });
  }, [setDimensions]);

  useResizeObserver({ref: el, onResize});

  return <Stack ref={el}>{children(dimensions)}</Stack>;
}

const Stack = styled('div')`
  height: 100%;
  display: grid;
  grid-template: 1 / 1;
  > * {
    grid-area: 1 /1;
  }
`;

export default StackedContent;
