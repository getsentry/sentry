import type {RefObject} from 'react';
import {useLayoutEffect, useState} from 'react';

import {useWindowSize} from 'sentry/utils/window/useWindowSize';

export function useElementWidth<Element extends HTMLElement>(
  elementRef: RefObject<Element | null>
) {
  const [width, setWidth] = useState(elementRef.current?.getBoundingClientRect().width);
  const {innerWidth} = useWindowSize();

  useLayoutEffect(() => {
    setWidth(elementRef.current?.getBoundingClientRect().width);
  }, [elementRef, innerWidth]);

  return width;
}
