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
    const childElement = childRef.current;

    if (!childElement) {
      return;
    }

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

    const childFitsIntoParent =
      childDimensions.width <= parentDimensions.width &&
      childDimensions.height <= parentDimensions.height;

    if (
      childFitsIntoParent &&
      (widthDisparity <= MAXIMUM_DISPARITY || heightDisparity <= MAXIMUM_DISPARITY)
    ) {
      // The child fits completely into the parent _and_ at least one dimension is very similar to the parent size (i.e., it fits nicely in the parent). Abandon, we're done!
      return;
    }

    if (
      childDimensions.width > parentDimensions.width ||
      childDimensions.height > parentDimensions.height
    ) {
      // The element is bigger than the parent, scale down
      const newFontSize = (fontSizeLowerBound.current + fontSize.current) / 2;

      fontSizeUpperBound.current = fontSize.current;
      fontSize.current = newFontSize;
      calculationCount.current += 1;

      childElement.style.fontSize = `${newFontSize}px`;
    } else if (
      childDimensions.width < parentDimensions.width ||
      childDimensions.height < parentDimensions.height
    ) {
      // The element is too small, scale up

      const newFontSize = (fontSizeUpperBound.current + fontSize.current) / 2;

      fontSizeUpperBound.current = fontSize.current;
      fontSize.current = newFontSize;
      calculationCount.current += 1;

      childElement.style.fontSize = `${newFontSize}px`;
    }
  };

  useLayoutEffect(() => {
    const childElement = childRef.current;

    if (!childElement) {
      return;
    }

    const parentElement = childRef.current.parentElement;

    if (!parentElement) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries.find(e => e.target === parentElement);

      if (!entry) {
        return;
      }

      const parentDimensions = entry.contentRect;
      const childDimensions = getElementDimensions(childElement);

      calculationCount.current = 0;
      fontSizeLowerBound.current = minFontSize;
      fontSizeUpperBound.current = maxFontSize;

      fitChildIntoParent(parentDimensions, childDimensions);
    });

    observer.observe(parentElement);

    return () => {
      observer.disconnect();
    };
  });

  useLayoutEffect(() => {
    const childElement = childRef.current;

    if (!childElement) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries.find(e => e.target === childRef.current);

      if (!entry) {
        return;
      }

      const childElement = entry.target as HTMLDivElement;
      const parentElement = childElement.parentElement;

      if (!parentElement) {
        return;
      }

      const childDimensions = entry.contentRect;
      const parentDimensions = getElementDimensions(parentElement);

      if (calculationCount.current >= calculationCountLimit) {
        return;
      }

      fitChildIntoParent(parentDimensions, childDimensions);
    });

    observer.observe(childElement);

    return () => {
      observer.disconnect();
    };
  }, [calculationCountLimit]);

  return <SizedChild ref={childRef}>{children}</SizedChild>;
}

const SizedChild = styled('div')`
  display: inline-block;
`;

const DEFAULT_CALCULATION_COUNT_LIMIT = 10;
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
  return Math.abs(1 - Math.abs(a[dimension] / b[dimension]));
}

function getElementDimensions(element: HTMLElement): Dimensions {
  const bbox = element.getBoundingClientRect();

  return {
    width: bbox.width,
    height: bbox.height,
  };
}
