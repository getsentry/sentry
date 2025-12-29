import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {getAppSizeCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTreemapTheme';
import {TreemapType, type TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';

interface AppSizeLegendProps {
  onToggleCategory: (category: TreemapType) => void;
  root: TreemapElement;
  selectedCategories: Set<TreemapType>;
}

export function AppSizeLegend({
  root,
  selectedCategories,
  onToggleCategory,
}: AppSizeLegendProps) {
  const theme = useTheme();
  const appSizeCategoryInfo = getAppSizeCategoryInfo(theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const allItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [isMoreHovered, setIsMoreHovered] = useState(false);

  const sortedCategories = useMemo(() => {
    const categoryTypes = new Set<TreemapType>();

    function collectCategories(element: TreemapElement) {
      if (element.type) {
        categoryTypes.add(element.type);
      }
      if (element.children) {
        element.children.forEach(child => collectCategories(child));
      }
    }

    collectCategories(root);

    return Array.from(categoryTypes).sort((a, b) => {
      const categoryA = appSizeCategoryInfo[a];
      const categoryB = appSizeCategoryInfo[b];
      return (categoryA?.displayName || a).localeCompare(categoryB?.displayName || b);
    });
  }, [root, appSizeCategoryInfo]);

  useLayoutEffect(() => {
    let rafId: number | null = null;
    let lastWidth = 0;

    const calculateVisibleItems = () => {
      if (
        !containerRef.current ||
        !measurementRef.current ||
        sortedCategories.length === 0
      ) {
        return;
      }

      const containerWidth = containerRef.current.offsetWidth;
      const gapSize =
        typeof theme.space.xs === 'string' ? parseFloat(theme.space.xs) : theme.space.xs;
      const buffer = 16;
      let totalWidth = 0;
      let fitCount = sortedCategories.length;

      for (let i = 0; i < sortedCategories.length; i++) {
        const item = allItemRefs.current[i];
        if (!item) {
          fitCount = i;
          break;
        }

        const itemWidth = item.offsetWidth;
        const neededWidth = totalWidth + (i > 0 ? gapSize : 0) + itemWidth;
        const hasMoreItems = i < sortedCategories.length - 1;
        const moreButtonWidth = moreButtonRef.current?.offsetWidth ?? 100;
        const maxWidth = hasMoreItems
          ? containerWidth - moreButtonWidth - gapSize + buffer
          : containerWidth - buffer;

        if (neededWidth > maxWidth) {
          fitCount = i;
          break;
        }

        totalWidth = neededWidth;
      }

      const newVisibleCount =
        fitCount === sortedCategories.length ? null : Math.max(1, fitCount);

      setVisibleCount(prev => (prev === newVisibleCount ? prev : newVisibleCount));
    };

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;

      const currentWidth = entry.contentRect.width;

      if (Math.abs(currentWidth - lastWidth) > 1) {
        lastWidth = currentWidth;

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(calculateVisibleItems);
      }
    });

    if (containerRef.current) {
      lastWidth = containerRef.current.offsetWidth;
      rafId = requestAnimationFrame(calculateVisibleItems);
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
    };
  }, [sortedCategories, theme.space.xs]);

  useLayoutEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const visibleCategories =
    visibleCount === null ? sortedCategories : sortedCategories.slice(0, visibleCount);
  const hiddenCategories =
    visibleCount === null ? [] : sortedCategories.slice(visibleCount);

  const handleMoreMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsMoreHovered(true);
  };

  const handleMoreMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsMoreHovered(false);
    }, 200);
  };

  const getCategoryInfo = (categoryType: TreemapType) => {
    return appSizeCategoryInfo[categoryType] ?? appSizeCategoryInfo[TreemapType.OTHER];
  };

  const renderLegendItem = (
    categoryType: TreemapType,
    isActive: boolean,
    options?: {
      onClick?: () => void;
      ref?: (el: HTMLDivElement | null) => void;
    }
  ) => {
    const categoryInfo = getCategoryInfo(categoryType);
    if (!categoryInfo) return null;

    return (
      <LegendItem
        key={categoryType}
        ref={options?.ref}
        onClick={options?.onClick}
        isActive={isActive}
      >
        <LegendDot style={{backgroundColor: categoryInfo.color}} isActive={isActive} />
        <LegendLabel>{categoryInfo.displayName}</LegendLabel>
      </LegendItem>
    );
  };

  return (
    <LegendContainer ref={containerRef}>
      <MeasurementContainer ref={measurementRef}>
        {sortedCategories.map((categoryType, index) => {
          const isActive =
            selectedCategories.size === 0 || selectedCategories.has(categoryType);
          return renderLegendItem(categoryType, isActive, {
            ref: el => {
              allItemRefs.current[index] = el;
            },
          });
        })}
      </MeasurementContainer>

      <Flex
        gap="xs"
        wrap={hiddenCategories.length > 0 ? 'nowrap' : 'wrap'}
        align="center"
        justify="end"
      >
        {visibleCategories.map(categoryType => {
          const isActive =
            selectedCategories.size === 0 || selectedCategories.has(categoryType);
          return renderLegendItem(categoryType, isActive, {
            onClick: () => onToggleCategory(categoryType),
          });
        })}
        {hiddenCategories.length > 0 && (
          <MoreContainer
            ref={moreButtonRef}
            onMouseEnter={handleMoreMouseEnter}
            onMouseLeave={handleMoreMouseLeave}
          >
            <LegendItem isActive>
              <MoreLabel>+{hiddenCategories.length} more</MoreLabel>
            </LegendItem>
            {isMoreHovered && (
              <MoreDropdown
                onMouseEnter={handleMoreMouseEnter}
                onMouseLeave={handleMoreMouseLeave}
              >
                {hiddenCategories.map(categoryType => {
                  const isActive =
                    selectedCategories.size === 0 || selectedCategories.has(categoryType);
                  return renderLegendItem(categoryType, isActive, {
                    onClick: () => onToggleCategory(categoryType),
                  });
                })}
              </MoreDropdown>
            )}
          </MoreContainer>
        )}
      </Flex>
    </LegendContainer>
  );
}

const LegendContainer = styled('div')`
  position: relative;
`;

const MeasurementContainer = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  visibility: hidden;
  pointer-events: none;
  display: flex;
  gap: ${p => p.theme.space.xs};
  flex-wrap: nowrap;
  white-space: nowrap;
  overflow: hidden;
`;

const LegendItem = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  cursor: pointer;
  padding: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  opacity: ${p => (p.isActive ? 1 : 0.4)};
  flex-shrink: 0;
  transition:
    opacity 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    background-color: ${p => p.theme.colors.surface200};
    opacity: ${p => (p.isActive ? 1 : 0.6)};
  }
`;

const LegendDot = styled('div')<{isActive: boolean}>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: transform 0.2s ease;
  transform: scale(${p => (p.isActive ? 1 : 0.8)});
`;

const LegendLabel = styled('span')`
  font-size: 12px;
  color: ${p => p.theme.tokens.content.primary};
  font-weight: 400;
`;

const MoreContainer = styled('div')`
  position: relative;
  flex-shrink: 0;
`;

const MoreLabel = styled('span')`
  font-size: 12px;
  color: ${p => p.theme.tokens.content.primary};
  font-weight: 500;
  white-space: nowrap;
`;

const MoreDropdown = styled('div')`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 2px;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  padding: ${p => p.theme.space.xs};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xs']};
  min-width: 150px;
  z-index: 1000;
`;
