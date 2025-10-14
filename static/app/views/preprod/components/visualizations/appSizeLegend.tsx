import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {getAppSizeCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTheme';
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
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
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
    let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const calculateVisibleItems = () => {
      if (!containerRef.current || sortedCategories.length === 0) {
        return;
      }

      const firstItemTop = itemRefs.current[0]?.getBoundingClientRect().top;
      if (firstItemTop === undefined) {
        return;
      }

      let count = 0;
      for (let i = 0; i < sortedCategories.length; i++) {
        const item = itemRefs.current[i];
        if (item) {
          const itemTop = item.getBoundingClientRect().top;
          if (Math.abs(itemTop - firstItemTop) < 2) {
            count++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (count === sortedCategories.length) {
        setVisibleCount(null);
      } else {
        setVisibleCount(Math.max(1, count - 1));
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeoutId !== null) {
        clearTimeout(resizeTimeoutId);
      }
      setVisibleCount(null);
      resizeTimeoutId = setTimeout(calculateVisibleItems, 10);
    });

    const initialTimeoutId = setTimeout(calculateVisibleItems, 0);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(initialTimeoutId);
      if (resizeTimeoutId !== null) {
        clearTimeout(resizeTimeoutId);
      }
      resizeObserver.disconnect();
    };
  }, [sortedCategories]);

  const visibleCategories =
    visibleCount === null ? sortedCategories : sortedCategories.slice(0, visibleCount);
  const hiddenCategories =
    visibleCount === null ? [] : sortedCategories.slice(visibleCount);

  return (
    <LegendContainer ref={containerRef}>
      <Flex
        gap="xs"
        wrap={hiddenCategories.length > 0 ? 'nowrap' : 'wrap'}
        align="center"
        justify="end"
      >
        {visibleCategories.map((categoryType, index) => {
          const categoryInfo =
            appSizeCategoryInfo[categoryType] ?? appSizeCategoryInfo[TreemapType.OTHER];
          if (!categoryInfo) {
            return null;
          }
          const isActive =
            selectedCategories.size === 0 || selectedCategories.has(categoryType);
          return (
            <LegendItem
              key={categoryType}
              ref={el => {
                itemRefs.current[index] = el;
              }}
              onClick={() => onToggleCategory(categoryType)}
              isActive={isActive}
            >
              <LegendDot
                style={{backgroundColor: categoryInfo.color}}
                isActive={isActive}
              />
              <LegendLabel>{categoryInfo.displayName}</LegendLabel>
            </LegendItem>
          );
        })}
        {hiddenCategories.length > 0 && (
          <MoreContainer
            onMouseEnter={() => setIsMoreHovered(true)}
            onMouseLeave={() => setIsMoreHovered(false)}
          >
            <LegendItem isActive>
              <MoreLabel>+{hiddenCategories.length} more</MoreLabel>
            </LegendItem>
            {isMoreHovered && (
              <MoreDropdown>
                {hiddenCategories.map(categoryType => {
                  const categoryInfo =
                    appSizeCategoryInfo[categoryType] ??
                    appSizeCategoryInfo[TreemapType.OTHER];
                  if (!categoryInfo) {
                    return null;
                  }
                  const isActive =
                    selectedCategories.size === 0 || selectedCategories.has(categoryType);
                  return (
                    <LegendItem
                      key={categoryType}
                      onClick={() => onToggleCategory(categoryType)}
                      isActive={isActive}
                    >
                      <LegendDot
                        style={{backgroundColor: categoryInfo.color}}
                        isActive={isActive}
                      />
                      <LegendLabel>{categoryInfo.displayName}</LegendLabel>
                    </LegendItem>
                  );
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

const LegendItem = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  cursor: pointer;
  padding: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.borderRadius};
  opacity: ${p => (p.isActive ? 1 : 0.4)};
  flex-shrink: 0;
  transition:
    opacity 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    background-color: ${p => p.theme.surface100};
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
  color: ${p => p.theme.textColor};
  font-weight: 400;
`;

const MoreContainer = styled('div')`
  position: relative;
  flex-shrink: 0;
`;

const MoreLabel = styled('span')`
  font-size: 12px;
  color: ${p => p.theme.textColor};
  font-weight: 500;
  white-space: nowrap;
`;

const MoreDropdown = styled('div')`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: ${p => p.theme.space.xs};
  background: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  padding: ${p => p.theme.space.xs};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xs']};
  min-width: 150px;
  z-index: 1000;
`;
