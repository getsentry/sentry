import {useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

interface Props {
  children: React.ReactNode;
  maximumDifference?: number;
}

export function AutoSizedText({
  children,
  maximumDifference = DEFAULT_MAXIMUM_DIFFERENCE,
}: Props) {
  const childRef = useRef<HTMLDivElement>(null);

  const fontSize = useRef<number>(0);
  const fontSizeLowerBound = useRef<number>(0);
  const fontSizeUpperBound = useRef<number>(0);

  useLayoutEffect(() => {
    const childElement = childRef.current; // This is `SizedChild`
    const parentElement = childRef.current?.parentElement; // This is the parent of `AutoSizedText`

    if (!childElement || !parentElement) {
      return () => {};
    }

    // On component first mount, register a `ResizeObserver` on the containing element. The handler fires
    // on component mount, and every time the element changes size after that
    const observer = new ResizeObserver(entries => {
      // The entries list contains an array of every observed item. Here it is only one element
      const entry = entries[0];

      if (!entry) {
        return;
      }

      // The resize handler passes the parent's dimensions, so we don't have to get the bounding box
      const parentDimensions = entry.contentRect;

      // Reset the iteration parameters
      fontSizeLowerBound.current = 0;
      fontSizeUpperBound.current = parentDimensions.height;

      let iterationCount = 0;

      const span = Sentry.startInactiveSpan({
        op: 'function',
        name: 'AutoSizedText.iterate',
      });

      // Run the resize iteration in a loop. This blocks the main UI thread and prevents
      // visible layout jitter. If this was done through a `ResizeObserver` or React State
      // each step in the resize iteration would be visible to the user
      while (iterationCount <= ITERATION_LIMIT) {
        const childDimensions = getElementDimensions(childElement);

        const widthDifference = parentDimensions.width - childDimensions.width;
        const heightDifference = parentDimensions.height - childDimensions.height;

        const childFitsIntoParent = heightDifference > 0 && widthDifference > 0;
        const childIsWithinWidthTolerance =
          Math.abs(widthDifference) <= maximumDifference;
        const childIsWithinHeightTolerance =
          Math.abs(heightDifference) <= maximumDifference;

        if (
          childFitsIntoParent &&
          (childIsWithinWidthTolerance || childIsWithinHeightTolerance)
        ) {
          // Stop the iteration, we've found a fit!
          return;
        }

        adjustFontSize(childDimensions, parentDimensions);

        iterationCount += 1;
      }

      span.setAttribute('iterationCount', iterationCount);
      span.end();
    });

    observer.observe(parentElement);

    return () => {
      observer.disconnect();
    };
  }, [maximumDifference]);

  const adjustFontSize = (childDimensions: Dimensions, parentDimensions: Dimensions) => {
    const childElement = childRef.current;

    if (!childElement) {
      return;
    }

    let newFontSize;

    if (
      childDimensions.width > parentDimensions.width ||
      childDimensions.height > parentDimensions.height
    ) {
      // The element is bigger than the parent, scale down
      newFontSize = (fontSizeLowerBound.current + fontSize.current) / 2;
      fontSizeUpperBound.current = fontSize.current;
    } else if (
      childDimensions.width < parentDimensions.width ||
      childDimensions.height < parentDimensions.height
    ) {
      // The element is smaller than the parent, scale up
      newFontSize = (fontSizeUpperBound.current + fontSize.current) / 2;
      fontSizeLowerBound.current = fontSize.current;
    }

    // Store font size in a ref so we don't have to measure styles to get it
    fontSize.current = newFontSize;
    childElement.style.fontSize = `${newFontSize}px`;
  };

  return <SizedChild ref={childRef}>{children}</SizedChild>;
}

const SizedChild = styled('div')`
  display: inline-block;
`;

const ITERATION_LIMIT = 50;
const DEFAULT_MAXIMUM_DIFFERENCE = 5; // px

type Dimensions = {
  height: number;
  width: number;
};

function getElementDimensions(element: HTMLElement): Dimensions {
  const bbox = element.getBoundingClientRect();

  return {
    width: bbox.width,
    height: bbox.height,
  };
}
