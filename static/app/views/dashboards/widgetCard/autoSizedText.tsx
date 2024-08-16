import {useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';

interface Props {
  children: React.ReactNode;
  maxFontSize: number;
  minFontSize: number;
  calculationCountLimit?: number;
}

export function AutoSizedText({
  children,
  minFontSize,
  maxFontSize,
  calculationCountLimit = DEFAULT_CALCULATION_COUNT_LIMIT,
}: Props) {
  const childRef = useRef<HTMLDivElement>(null);

  const fontSize = useRef<number>((maxFontSize + minFontSize) / 2);
  const fontSizeLowerBound = useRef<number>(minFontSize);
  const fontSizeUpperBound = useRef<number>(maxFontSize);

  const calculationCount = useRef<number>(0);

  const fitChildIntoParent = (
    parentDimensions: Dimensions,
    childDimensions: Dimensions
  ) => {
    if (!childRef.current) {
      return;
    }

    console.log('Running fitment iteration', calculationCount.current);

    // Calculate the width and height disparity between the child and parent. A disparity of 0 means they're the same size.
    const widthDisparity = calculateDimensionDisparity(
      childDimensions,
      parentDimensions,
      'width'
    );

    const heightDisparity = calculateDimensionDisparity(
      childDimensions,
      parentDimensions,
      'height'
    );

    console.log({widthDisparity, heightDisparity});

    const childFitsIntoParent =
      childDimensions.width <= parentDimensions.width &&
      childDimensions.height <= parentDimensions.height;

    if (
      childFitsIntoParent &&
      (widthDisparity <= MAXIMUM_DISPARITY || heightDisparity <= MAXIMUM_DISPARITY)
    ) {
      // The child fits completely into the parent _and_ at least one dimension is very similar to the parent size (i.e., it fits nicely in the parent). Abandon, we're done!
      console.log('Fitment complete! Success');

      return;
    }

    if (
      childDimensions.width > parentDimensions.width ||
      childDimensions.height > parentDimensions.height
    ) {
      // The element is bigger than the parent, scale down
      console.log('Too big!');

      const newFontSize = (fontSizeLowerBound.current + fontSize.current) / 2;

      fontSizeUpperBound.current = fontSize.current;
      fontSize.current = newFontSize;
      calculationCount.current += 1;

      console.log('Setting new size', newFontSize);

      childRef.current.style.fontSize = `${newFontSize}px`;
    } else if (
      childDimensions.width < parentDimensions.width ||
      childDimensions.height < parentDimensions.height
    ) {
      // The element is too small, scale up
      console.log('Too small!');

      const newFontSize = (fontSizeUpperBound.current + fontSize.current) / 2;

      fontSizeUpperBound.current = fontSize.current;
      fontSize.current = newFontSize;
      calculationCount.current += 1;

      console.log('Setting new size', newFontSize);

      childRef.current.style.fontSize = `${newFontSize}px`;
    }
  };

  useLayoutEffect(() => {
    const child = childRef.current;

    if (!child) {
      return;
    }

    const parent = childRef.current.parentElement;

    if (!parent) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries.find(e => e.target === parent);

      if (!entry) {
        return;
      }

      console.log('Noticed parent element size change');
      console.log('Resetting the iteration');

      const parentDimensions = entry.contentRect;
      const childDimensions = getElementDimensions(child);

      calculationCount.current = 0;
      fontSizeLowerBound.current = minFontSize;
      fontSizeUpperBound.current = maxFontSize;

      // TODO: Toggle child size change so the calculation kicks off
      fitChildIntoParent(parentDimensions, childDimensions);
    });

    if (parent) {
      observer.observe(parent);
    }

    return () => {
      observer.disconnect();
    };
  });

  useLayoutEffect(() => {
    const observer = new ResizeObserver(entries => {
      const entry = entries.find(e => e.target === childRef.current);

      if (!entry) {
        return;
      }

      console.log('Noticed child element size change');

      const child = entry.target;
      const parent = child.parentElement;

      if (!parent) {
        return;
      }

      const childDimensions = entry.contentRect;
      const parentDimensions = getElementDimensions(parent);

      if (calculationCount.current >= calculationCountLimit) {
        console.log('Exceeded iteration count');
        return;
      }

      fitChildIntoParent(parentDimensions, childDimensions);
    });

    if (childRef.current) {
      observer.observe(childRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <ParentSizeMimic>
      <SizedChild ref={childRef}>{children}</SizedChild>
    </ParentSizeMimic>
  );
}

const ParentSizeMimic = styled('div')`
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
`;

const SizedChild = styled('div')`
  display: inline-block;
`;

const DEFAULT_CALCULATION_COUNT_LIMIT = 5;
const MAXIMUM_DISPARITY = 0.05;

type Dimensions = {
  height: number;
  width: number;
};

function calculateDimensionDisparity(
  a: Dimensions,
  b: Dimensions,
  dimension: 'height' | 'width'
): number {
  return 1 - Math.abs(a[dimension] / b[dimension]);
}

function getElementDimensions(element: HTMLElement): Dimensions {
  const bbox = element.getBoundingClientRect();

  return {
    width: bbox.width,
    height: bbox.height,
  };
}
