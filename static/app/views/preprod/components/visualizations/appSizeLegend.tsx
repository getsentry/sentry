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

  const sortedCategories = Array.from(categoryTypes).sort((a, b) => {
    const categoryA = appSizeCategoryInfo[a];
    const categoryB = appSizeCategoryInfo[b];
    return (categoryA?.displayName || a).localeCompare(categoryB?.displayName || b);
  });

  return (
    <Flex gap="xs" wrap="wrap" align="center" justify="end">
      {sortedCategories.map(categoryType => {
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
            onClick={() => onToggleCategory(categoryType)}
            isActive={isActive}
          >
            <LegendDot
              style={{backgroundColor: categoryInfo.color}}
              isActive={isActive}
            />
            <LegendLabel isActive={isActive}>{categoryInfo.displayName}</LegendLabel>
          </LegendItem>
        );
      })}
    </Flex>
  );
}

const LegendItem = styled('div')<{isActive: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  cursor: pointer;
  padding: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.borderRadius};
  opacity: ${p => (p.isActive ? 1 : 0.4)};
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

const LegendLabel = styled('span')<{isActive: boolean}>`
  font-size: 12px;
  color: ${p => p.theme.textColor};
  font-weight: 400;
`;
