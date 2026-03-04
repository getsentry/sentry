import type React from 'react';
import {Fragment, memo, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconArrow, IconChevron, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import useOrganization from 'sentry/utils/useOrganization';
import {PercentInput} from 'sentry/views/settings/dynamicSampling/percentInput';
import {useHasDynamicSamplingWriteAccess} from 'sentry/views/settings/dynamicSampling/utils/access';
import {parsePercent} from 'sentry/views/settings/dynamicSampling/utils/parsePercent';
import type {
  ProjectionSamplePeriod,
  ProjectSampleCount,
} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

type SubProject = ProjectSampleCount['subProjects'][number];

interface ProjectItem {
  count: number;
  initialSampleRate: string;
  ownCount: number;
  project: Project;
  sampleRate: string;
  subProjects: SubProject[];
  error?: string;
}

interface ProjectTableItem extends ProjectItem {
  isExpanded: boolean;
}

interface Props {
  emptyMessage: React.ReactNode;
  isLoading: boolean;
  items: ProjectItem[];
  period: ProjectionSamplePeriod;
  rateHeader: React.ReactNode;
  canEdit?: boolean;
  inputTooltip?: string;
  onChange?: (projectId: string, value: string) => void;
}

const BASE_ROW_HEIGHT = 63;
const MAX_SCROLL_HEIGHT = 400;

export function ProjectsTable({
  items,
  inputTooltip,
  canEdit,
  rateHeader,
  onChange,
  period,
  isLoading,
  emptyMessage,
}: Props) {
  const hasAccess = useHasDynamicSamplingWriteAccess();
  const [tableSort, setTableSort] = useState<'asc' | 'desc'>('desc');
  // We store the expanded items at list level to allow calculating item height
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleToggleItemExpanded = useCallback((id: string) => {
    setExpandedItems(value => {
      const newSet = new Set(value);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleTableSort = useCallback(() => {
    setTableSort(value => (value === 'asc' ? 'desc' : 'asc'));
  }, []);

  const sortedItems = useMemo(() => {
    const itemsWithExpanded: ProjectTableItem[] = items.map(item => ({
      ...item,
      isExpanded: expandedItems.has(item.project.id),
    }));

    itemsWithExpanded.sort((a, b) => {
      if (a.count === b.count) {
        return a.project.slug.localeCompare(b.project.slug);
      }
      if (tableSort === 'asc') {
        return a.count - b.count;
      }
      return b.count - a.count;
    });

    return itemsWithExpanded;
  }, [items, expandedItems, tableSort]);

  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: index =>
      sortedItems[index]?.isExpanded
        ? BASE_ROW_HEIGHT + (sortedItems[index].subProjects.length + 1) * 21
        : BASE_ROW_HEIGHT,
    overscan: 5,
    getItemKey: index => sortedItems[index]?.project.id ?? index,
  });

  return (
    <Fragment>
      <TableHeader background="secondary" overflow="hidden">
        <Cell direction="column" padding="xl">
          {t('Originating Project')}
        </Cell>
        <SortableHeader type="button" key="spans" onClick={handleTableSort}>
          {t('Accepted Spans')}
          <IconArrow direction={tableSort === 'desc' ? 'down' : 'up'} size="xs" />
        </SortableHeader>
        <Cell direction="column" padding="xl" align="end">
          {period === '24h' ? t('Stored Spans (24h)') : t('Stored Spans (30d)')}
        </Cell>
        <Cell direction="column" padding="xl" align="end">
          {rateHeader}
        </Cell>
      </TableHeader>
      {isLoading && <LoadingIndicator />}

      {items.length === 0 && !isLoading && (
        <EmptyStateWarning>
          <p>{emptyMessage}</p>
        </EmptyStateWarning>
      )}
      {!isLoading && items.length > 0 && (
        <Container
          ref={scrollContainerRef}
          overflowY="auto"
          style={{height: Math.min(virtualizer.getTotalSize(), MAX_SCROLL_HEIGHT)}}
        >
          <div style={{height: virtualizer.getTotalSize(), position: 'relative'}}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const item = sortedItems[virtualRow.index];
              if (!item) {
                return null;
              }
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TableRow
                    canEdit={canEdit}
                    onChange={onChange}
                    inputTooltip={inputTooltip}
                    toggleExpanded={handleToggleItemExpanded}
                    hasAccess={hasAccess}
                    {...item}
                  />
                </div>
              );
            })}
          </div>
        </Container>
      )}
    </Fragment>
  );
}

function getSubProjectContent(
  ownSlug: string,
  subProjects: SubProject[],
  isExpanded: boolean
) {
  let subProjectContent: React.ReactNode = (
    <Text variant="muted" ellipsis>
      {t('No distributed traces')}
    </Text>
  );
  if (subProjects.length > 0) {
    const truncatedSubProjects = subProjects.slice(0, MAX_PROJECTS_COLLAPSED);
    const overflowCount = subProjects.length - MAX_PROJECTS_COLLAPSED;
    const moreTranslation = t('+%d more', overflowCount);
    const stringifiedSubProjects =
      overflowCount > 0
        ? `${truncatedSubProjects.map(p => p.project.slug).join(', ')}, ${moreTranslation}`
        : oxfordizeArray(truncatedSubProjects.map(p => p.project.slug));

    subProjectContent = isExpanded ? (
      <Fragment>
        <div>{ownSlug}</div>
        {subProjects.map(subProject => (
          <div key={subProject.project.slug}>{subProject.project.slug}</div>
        ))}
      </Fragment>
    ) : (
      <Text variant="muted" ellipsis>
        {t('Including spans in ') + stringifiedSubProjects}
      </Text>
    );
  }

  return subProjectContent;
}

function getSubSpansContent(
  ownCount: number,
  subProjects: SubProject[],
  isExpanded: boolean
) {
  let subSpansContent: React.ReactNode = '';
  if (subProjects.length > 0) {
    const subProjectSum = subProjects.reduce(
      (acc, subProject) => acc + subProject.count,
      0
    );

    subSpansContent = isExpanded ? (
      <Fragment>
        <div>{formatAbbreviatedNumber(ownCount, 2)}</div>
        {subProjects.map(subProject => (
          <div key={subProject.project.slug}>
            {formatAbbreviatedNumber(subProject.count)}
          </div>
        ))}
      </Fragment>
    ) : (
      formatAbbreviatedNumber(subProjectSum)
    );
  }

  return subSpansContent;
}

function getStoredSpansContent(
  ownCount: number,
  subProjects: SubProject[],
  sampleRate: number,
  isExpanded: boolean
) {
  let subSpansContent: React.ReactNode = '';
  if (subProjects.length > 0) {
    const subProjectSum = subProjects.reduce(
      (acc, subProject) => acc + Math.floor(subProject.count * sampleRate),
      0
    );

    subSpansContent = isExpanded ? (
      <Fragment>
        <div>{formatAbbreviatedNumber(Math.floor(ownCount * sampleRate), 2)}</div>
        {subProjects.map(subProject => (
          <div key={subProject.project.slug}>
            {formatAbbreviatedNumber(Math.floor(subProject.count * sampleRate))}
          </div>
        ))}
      </Fragment>
    ) : (
      formatAbbreviatedNumber(subProjectSum)
    );
  }

  return subSpansContent;
}

const MAX_PROJECTS_COLLAPSED = 3;
const TableRow = memo(function TableRow({
  project,
  hasAccess,
  canEdit,
  count,
  ownCount,
  sampleRate,
  initialSampleRate,
  isExpanded,
  toggleExpanded,
  subProjects,
  error,
  inputTooltip: inputTooltipProp,
  onChange,
}: {
  count: number;
  hasAccess: boolean;
  initialSampleRate: string;
  isExpanded: boolean;
  ownCount: number;
  project: Project;
  sampleRate: string;
  subProjects: SubProject[];
  toggleExpanded: (id: string) => void;
  canEdit?: boolean;
  error?: string;
  inputTooltip?: string;
  onChange?: (projectId: string, value: string) => void;
}) {
  const organization = useOrganization();

  const isExpandable = subProjects.length > 0;
  const hasProjectAccess = hasEveryAccess(['project:write'], {organization, project});

  const subProjectContent = getSubProjectContent(project.slug, subProjects, isExpanded);
  const subSpansContent = getSubSpansContent(ownCount, subProjects, isExpanded);

  let inputTooltip = inputTooltipProp;
  if (!hasAccess) {
    inputTooltip = t('You do not have permission to change the sample rate.');
  }

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(project.id, event.target.value);
    },
    [onChange, project.id]
  );

  const storedSpans = Math.floor(count * parsePercent(sampleRate));
  return (
    <TableRowWrapper overflow="hidden">
      <Cell direction="column" padding="md xl">
        <FirstCellLine
          align="center"
          height="32px"
          paddingLeft={isExpandable ? undefined : 'xl'}
        >
          <HiddenButton
            type="button"
            disabled={!isExpandable}
            aria-label={isExpanded ? t('Collapse') : t('Expand')}
            onClick={() => {
              toggleExpanded(project.id);
            }}
          >
            {isExpandable && (
              <StyledIconChevron direction={isExpanded ? 'down' : 'right'} />
            )}
            <ProjectBadge project={project} disableLink avatarSize={16} />
          </HiddenButton>
          {hasProjectAccess && (
            <SettingsButton
              tabIndex={-1}
              tooltipProps={{title: t('Open Project Settings')}}
              aria-label={t('Open Project Settings')}
              size="xs"
              priority="link"
              icon={<IconSettings />}
              to={`/settings/${organization.slug}/projects/${project.slug}/performance/`}
            />
          )}
        </FirstCellLine>
        <SubProjects data-is-first-column>{subProjectContent}</SubProjects>
      </Cell>
      <Cell direction="column" padding="md xl" align="end">
        <FirstCellLine align="center" height="32px" justify="end">
          {formatAbbreviatedNumber(count)}
        </FirstCellLine>
        <SubContent>{subSpansContent}</SubContent>
      </Cell>
      <Cell direction="column" padding="md xl" align="end">
        <FirstCellLine align="center" height="32px" justify="end">
          {formatAbbreviatedNumber(storedSpans)}
        </FirstCellLine>
        <SubContent data-is-last-column>
          {getStoredSpansContent(
            ownCount,
            subProjects,
            parsePercent(sampleRate),
            isExpanded
          )}
        </SubContent>
      </Cell>
      <Flex direction="column" padding="xl xl md xl" style={{minWidth: 0}}>
        <FirstCellLine align="center" height="32px">
          <Tooltip disabled={!inputTooltip} title={inputTooltip}>
            <PercentInput
              type="number"
              disabled={!canEdit || !hasAccess}
              onChange={handleChange}
              size="sm"
              value={sampleRate}
            />
          </Tooltip>
        </FirstCellLine>
        {error ? (
          <Text size="xs" variant="danger" align="right">
            {error}
          </Text>
        ) : sampleRate === initialSampleRate ? null : (
          <Text size="xs" variant="secondary" align="right">
            {t('previous: %s%%', initialSampleRate)}
          </Text>
        )}
      </Flex>
    </TableRowWrapper>
  );
});

const SortableHeader = styled('button')`
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  text-transform: inherit;
  align-items: center;
  justify-content: flex-end;
  gap: ${space(0.5)};
`;

const TableRowWrapper = styled(Grid)`
  grid-template-columns: 1fr 165px 165px 152px;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const Cell = styled(Flex)`
  min-width: 0;
`;

const FirstCellLine = styled(Flex)`
  & > * {
    flex-shrink: 0;
  }
`;

const SubContent = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  text-align: right;
  white-space: nowrap;

  & > div {
    line-height: 2;
    margin-left: -${space(2)};
    padding-left: ${space(2)};
    margin-right: -${space(2)};
    padding-right: ${space(2)};
    text-overflow: ellipsis;
    overflow: hidden;

    &:nth-child(odd) {
      background: ${p => p.theme.tokens.background.secondary};
    }
  }

  &[data-is-first-column] > div {
    margin-left: -${space(1)};
    padding-left: ${space(1)};
    border-top-left-radius: ${p => p.theme.radius.md};
    border-bottom-left-radius: ${p => p.theme.radius.md};
  }

  &[data-is-last-column] > div {
    margin-right: -${space(1)};
    padding-right: ${space(1)};
    border-top-right-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }
`;

const SubProjects = styled(SubContent)`
  text-align: left;
  margin-left: ${space(2)};
`;

const HiddenButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;

  /* Overwrite the platform icon's cursor style */
  &:not([disabled]) img {
    cursor: pointer;
  }
`;

const StyledIconChevron = styled(IconChevron)`
  height: 12px;
  width: 12px;
  margin-right: ${space(0.5)};
  color: ${p => p.theme.tokens.content.secondary};
`;

const SettingsButton = styled(LinkButton)`
  margin-left: ${space(0.5)};
  color: ${p => p.theme.tokens.content.secondary};
  visibility: hidden;

  &:focus {
    visibility: visible;
  }
  ${Cell}:hover & {
    visibility: visible;
  }
`;

const TableHeader = styled(TableRowWrapper)`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-transform: uppercase;
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  white-space: nowrap;
  line-height: 1;
  height: 45px;
`;
