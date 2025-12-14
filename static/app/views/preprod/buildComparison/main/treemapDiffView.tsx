import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type DiffType = 'added' | 'removed' | 'increased' | 'decreased';

interface TreemapDiffElement {
  children: TreemapDiffElement[] | null;
  color_intensity: number;
  diff_type: DiffType;
  is_dir: boolean;
  name: string;
  path: string | null;
  size: number;
  size_diff: number;
  type: string | null;
}

interface TreemapDiffResults {
  largest_decrease: number;
  largest_increase: number;
  root: TreemapDiffElement;
  total_size_diff: number;
}

interface TreemapDiffViewProps {
  treemapDiff: TreemapDiffResults;
}

const TreemapContainer = styled('div')`
  width: 100%;
  height: 400px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid ${p => p.theme.border};
`;

const TreemapRect = styled('div')<{
  backgroundColor: string;
  hasChildren: boolean;
  height: number;
  width: number;
  x: number;
  y: number;
}>`
  position: absolute;
  width: ${p => p.width}px;
  height: ${p => p.height}px;
  left: ${p => p.x}px;
  top: ${p => p.y}px;
  background-color: ${p => p.backgroundColor};
  border: 1px solid ${p => p.theme.border};
  cursor: ${p => (p.hasChildren ? 'pointer' : 'default')};
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

const TreemapLabel = styled('div')`
  position: absolute;
  padding: ${space(0.5)};
  font-size: 11px;
  color: ${p => p.theme.textColor};
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
`;

const LegendContainer = styled(Flex)`
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  flex-wrap: wrap;
`;

const LegendItem = styled(Flex)`
  align-items: center;
  gap: ${space(1)};
`;

const LegendColor = styled('div')<{color: string}>`
  width: 16px;
  height: 16px;
  background-color: ${p => p.color};
  border-radius: 2px;
  border: 1px solid ${p => p.theme.border};
`;

interface TreemapNode {
  element: TreemapDiffElement;
  height: number;
  width: number;
  x: number;
  y: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSizeDiff(sizeDiff: number): string {
  const sign = sizeDiff > 0 ? '+' : '';
  return sign + formatBytes(sizeDiff);
}

function getColorForDiff(diffType: DiffType, intensity: number, theme: any): string {
  const alpha = Math.max(0.2, intensity);

  switch (diffType) {
    case 'added':
      return `rgba(34, 197, 94, ${alpha})`; // Green for added files
    case 'increased':
      return `rgba(239, 68, 68, ${alpha})`; // Red for size increases
    case 'decreased':
      return `rgba(59, 130, 246, ${alpha})`; // Blue for size decreases
    case 'removed':
      return `rgba(156, 163, 175, ${alpha})`; // Gray for removed files
    default:
      return theme.background;
  }
}

function squarify(
  elements: TreemapDiffElement[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapNode[] {
  if (elements.length === 0) {
    return [];
  }

  // Simple row-based layout for treemap rectangles
  const totalSize = elements.reduce((sum, el) => sum + Math.abs(el.size), 0);

  if (totalSize === 0) {
    return elements.map((element, i) => ({
      element,
      height: height / elements.length,
      width,
      x,
      y: y + (i * height) / elements.length,
    }));
  }

  const nodes: TreemapNode[] = [];
  let currentY = y;

  elements.forEach(element => {
    const proportion = Math.abs(element.size) / totalSize;
    const nodeHeight = height * proportion;

    nodes.push({
      element,
      height: nodeHeight,
      width,
      x,
      y: currentY,
    });

    currentY += nodeHeight;
  });

  return nodes;
}

export function TreemapDiffView({treemapDiff}: TreemapDiffViewProps) {
  const theme = useTheme();
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const currentLevel = useMemo(() => {
    if (!expandedPath) {
      return treemapDiff.root.children || [treemapDiff.root];
    }

    // Find the expanded element in the tree
    function findElement(
      element: TreemapDiffElement,
      path: string
    ): TreemapDiffElement | null {
      if (element.path === path) {
        return element;
      }

      if (element.children) {
        for (const child of element.children) {
          const found = findElement(child, path);
          if (found) {
            return found;
          }
        }
      }

      return null;
    }

    const foundElement = findElement(treemapDiff.root, expandedPath);
    return (
      foundElement?.children || ([foundElement].filter(Boolean) as TreemapDiffElement[])
    );
  }, [treemapDiff.root, expandedPath]);

  const treemapNodes = useMemo(() => {
    return squarify(currentLevel, 0, 0, 800, 400);
  }, [currentLevel]);

  const handleRectClick = (element: TreemapDiffElement) => {
    if (element.children && element.children.length > 0) {
      setExpandedPath(element.path === expandedPath ? null : element.path);
    }
  };

  const legend = [
    {color: 'rgba(34, 197, 94, 0.6)', label: t('Added')},
    {color: 'rgba(239, 68, 68, 0.6)', label: t('Increased')},
    {color: 'rgba(59, 130, 246, 0.6)', label: t('Decreased')},
    {color: 'rgba(156, 163, 175, 0.6)', label: t('Removed')},
  ];

  return (
    <Container background="primary" radius="lg" padding="0" border="primary">
      <Flex direction="column" gap="0">
        <Flex align="center" justify="between" padding="xl">
          <Flex align="center" gap="sm">
            <Heading as="h2">
              {t('Size Treemap Diff (%s)', formatSizeDiff(treemapDiff.total_size_diff))}
            </Heading>
          </Flex>
          <Flex align="center" gap="sm">
            <Button
              priority="transparent"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? t('Collapse treemap') : t('Expand treemap')}
            >
              <IconChevron
                direction={isExpanded ? 'up' : 'down'}
                size="sm"
                style={{
                  transition: 'transform 0.2s ease',
                }}
              />
            </Button>
          </Flex>
        </Flex>

        {isExpanded && (
          <Stack paddingLeft="xl" paddingRight="xl" paddingBottom="xl">
            <LegendContainer>
              {legend.map(item => (
                <LegendItem key={item.label}>
                  <LegendColor color={item.color} />
                  <Text size="sm">{item.label}</Text>
                </LegendItem>
              ))}
            </LegendContainer>

            {expandedPath && (
              <Flex align="center" gap="sm">
                <Button priority="link" size="sm" onClick={() => setExpandedPath(null)}>
                  {t('← Back to root')}
                </Button>
                <Text size="sm" color="gray300">
                  {expandedPath}
                </Text>
              </Flex>
            )}

            <TreemapContainer>
              {treemapNodes.map((node, index) => {
                const color = getColorForDiff(
                  node.element.diff_type,
                  node.element.color_intensity,
                  theme
                );

                const shouldShowLabel = node.width > 40 && node.height > 20;

                return (
                  <TreemapRect
                    key={`${node.element.path}-${index}`}
                    width={node.width}
                    height={node.height}
                    x={node.x}
                    y={node.y}
                    backgroundColor={color}
                    hasChildren={Boolean(node.element.children?.length)}
                    onClick={() => handleRectClick(node.element)}
                    title={`${node.element.name} - ${formatBytes(node.element.size)} (${formatSizeDiff(node.element.size_diff)})`}
                  >
                    {shouldShowLabel && (
                      <TreemapLabel>
                        <div>{node.element.name}</div>
                        <div>
                          {formatBytes(node.element.size)}
                          {node.element.size_diff !== 0 && (
                            <span> ({formatSizeDiff(node.element.size_diff)})</span>
                          )}
                        </div>
                      </TreemapLabel>
                    )}
                  </TreemapRect>
                );
              })}
            </TreemapContainer>

            <Text size="sm" color="gray300">
              {t('Click on rectangles to drill down into directories')}
            </Text>
          </Stack>
        )}
      </Flex>
    </Container>
  );
}
