import {useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

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
  const [parentHeight, setParentHeight] = useState<number | null>(null);
  const [parentWidth, setParentWidth] = useState<number | null>(null);

  const [fontSize, setFontSize] = useState<number>((maxFontSize + minFontSize) / 2);
  const [fontSizeLowerBound, setFontSizeLowerBound] = useState<number>(minFontSize);
  const [fontSizeUpperBound, setFontSizeUpperBound] = useState<number>(maxFontSize);

  const [calculationCount, setCalculationCount] = useState<number>(0);

  const parentRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);

  const onResize = () => {
    const parentDimensions = getElementDimensions(parentRef.current);

    if (parentDimensions) {
      setCalculationCount(0);
      setFontSizeLowerBound(minFontSize);
      setFontSizeUpperBound(maxFontSize);

      setParentHeight(parentDimensions.height);
      setParentWidth(parentDimensions.width);
    }
  };

  useResizeObserver({
    ref: parentRef,
    onResize,
  });

  useLayoutEffect(() => {
    if (calculationCount > calculationCountLimit) {
      // Exceeded the iteration count. This should be unlikely! If it happens, abandon
      return;
    }

    const parentDimensions = getElementDimensions(parentRef.current);
    const childDimensions = getElementDimensions(childRef.current);

    if (!parentDimensions || !childDimensions) {
      // Refs are not ready or cannot be measured, abandon
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
      const newFontSize = (fontSizeLowerBound + fontSize) / 2;

      setCalculationCount(previousCalculationCount => previousCalculationCount + 1);
      setFontSizeUpperBound(fontSize);
      setFontSize(newFontSize);
    } else if (
      childDimensions.width < parentDimensions.width ||
      childDimensions.height < parentDimensions.height
    ) {
      // The element is too small, scale up
      const midpoint = (fontSizeUpperBound + fontSize) / 2;

      setCalculationCount(previousCalculationCount => previousCalculationCount + 1);
      setFontSizeLowerBound(fontSize);
      setFontSize(midpoint);
    }
  }, [
    fontSize,
    minFontSize,
    fontSizeLowerBound,
    maxFontSize,
    fontSizeUpperBound,
    calculationCount,
    calculationCountLimit,
    parentHeight,
    parentWidth,
  ]);

  return (
    <ParentSizeMimic ref={parentRef}>
      <SizedChild ref={childRef} style={{fontSize}}>
        {children}
      </SizedChild>
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

function getElementDimensions(element: HTMLDivElement | null): Dimensions | null {
  const bbox = element?.getBoundingClientRect();

  if (!bbox) {
    return null;
  }

  return {
    width: bbox.width,
    height: bbox.height,
  };
}
