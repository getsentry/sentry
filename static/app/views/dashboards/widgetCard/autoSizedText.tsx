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

  console.log(fontSize.current);

  const calculationCount = useRef<number>(0);

  const fitChildIntoParent = (
    childDimensions: Dimensions,
    parentDimensions: Dimensions
  ) => {
    const childElement = childRef.current;

    if (!childElement) {
      return;
    }

    console.log('fitChildIntoParent');

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
      console.log('Fit successful');

      return;
    }

    console.log(childDimensions, parentDimensions);
    console.log({fontSize: fontSize.current});

    let newFontSize;

    if (
      childDimensions.width > parentDimensions.width ||
      childDimensions.height > parentDimensions.height
    ) {
      // The element is bigger than the parent, scale down
      console.log('Too big');
      newFontSize = (fontSizeLowerBound.current + fontSize.current) / 2;

      fontSizeUpperBound.current = fontSize.current;
      fontSize.current = newFontSize;
    } else if (
      childDimensions.width < parentDimensions.width ||
      childDimensions.height < parentDimensions.height
    ) {
      // The element is too small, scale up
      console.log('Too small');

      newFontSize = (fontSizeUpperBound.current + fontSize.current) / 2;

      fontSizeUpperBound.current = fontSize.current;
      fontSize.current = newFontSize;
    }

    childElement.style.fontSize = `${newFontSize}px`;
    console.log('Changed font to', childElement.style.fontSize);
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

      calculationCount.current = 0;
      fontSizeLowerBound.current = minFontSize;
      fontSizeUpperBound.current = maxFontSize;

      while (calculationCount.current <= calculationCountLimit) {
        const childDimensions = getElementDimensions(childElement);
        const parentDimensions = entry.contentRect;

        calculationCount.current += 1;

        fitChildIntoParent(childDimensions, parentDimensions);
      }
    });

    observer.observe(parentElement);

    return () => {
      observer.disconnect();
    };
  }, []);

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
