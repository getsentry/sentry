import type React from 'react';
import {Fragment, memo, useCallback, useRef, useState} from 'react';
import {AutoSizer, List, type ListRowRenderer} from 'react-virtualized';
import styled from '@emotion/styled';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {LinkButton} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
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

const COLUMN_COUNT = 4;
const BASE_ROW_HEIGHT = 68;

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
  const listRef = useRef<List | null>(null);

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
    listRef.current?.recomputeRowHeights();
  }, []);

  const handleTableSort = useCallback(() => {
    setTableSort(value => (value === 'asc' ? 'desc' : 'asc'));
    listRef.current?.recomputeRowHeights();
  }, []);

  const itemsWithExpanded = items.map(item => ({
    ...item,
    isExpanded: expandedItems.has(item.project.id),
  }));

  const sortedItems = itemsWithExpanded.toSorted((a: any, b: any) => {
    if (a.count === b.count) {
      return a.project.slug.localeCompare(b.project.slug);
    }
    if (tableSort === 'asc') {
      return a.count - b.count;
    }
    return b.count - a.count;
  });

  const rowRenderer: ListRowRenderer = ({key, index, style}) => {
    const item = sortedItems[index];
    if (!item) {
      return null;
    }
    return (
      <TableRow
        key={key}
        style={style}
        canEdit={canEdit}
        onChange={onChange}
        inputTooltip={inputTooltip}
        toggleExpanded={handleToggleItemExpanded}
        hasAccess={hasAccess}
        {...item}
      />
    );
  };

  const estimatedListSize = sortedItems.length * BASE_ROW_HEIGHT;

  return (
    <Fragment>
      <TableHeader>
        <HeaderCell>{t('Originating Project')}</HeaderCell>
        <SortableHeader type="button" key="spans" onClick={handleTableSort}>
          {t('Accepted Spans')}
          <IconArrow direction={tableSort === 'desc' ? 'down' : 'up'} size="xs" />
        </SortableHeader>
        <HeaderCell data-align="right">
          {period === '24h' ? t('Stored Spans (24h)') : t('Stored Spans (30d)')}
        </HeaderCell>
        <HeaderCell data-align="right">{rateHeader}</HeaderCell>
      </TableHeader>
      {isLoading && <LoadingIndicator />}

      {items.length === 0 && !isLoading && (
        <EmptyStateWarning>
          <p>{emptyMessage}</p>
        </EmptyStateWarning>
      )}
      {!isLoading && items.length && (
        <SizingWrapper style={{height: `${estimatedListSize}px`}}>
          <AutoSizer>
            {({width, height}) => (
              <List
                ref={list => (listRef.current = list)}
                width={width}
                height={height}
                rowCount={sortedItems.length}
                rowRenderer={rowRenderer}
                rowHeight={({index}) =>
                  sortedItems[index]?.isExpanded
                    ? BASE_ROW_HEIGHT + (sortedItems[index]?.subProjects.length + 1) * 21
                    : BASE_ROW_HEIGHT
                }
                columnCount={COLUMN_COUNT}
              />
            )}
          </AutoSizer>
        </SizingWrapper>
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
    <Ellipsis>{t('No distributed traces')}</Ellipsis>
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
      <Ellipsis>{t('Including spans in ') + stringifiedSubProjects}</Ellipsis>
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
  style,
}: {
  count: number;
  hasAccess: boolean;
  initialSampleRate: string;
  isExpanded: boolean;
  ownCount: number;
  project: Project;
  sampleRate: string;
  style: React.CSSProperties;
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
    <TableRowWrapper style={style}>
      <Cell>
        <FirstCellLine data-has-chevron={isExpandable}>
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
              title={t('Open Project Settings')}
              aria-label={t('Open Project Settings')}
              size="xs"
              priority="link"
              icon={<IconSettings />}
              to={`/organizations/${organization.slug}/settings/projects/${project.slug}/performance`}
            />
          )}
        </FirstCellLine>
        <SubProjects data-is-first-column>{subProjectContent}</SubProjects>
      </Cell>
      <Cell>
        <FirstCellLine data-align="right">{formatAbbreviatedNumber(count)}</FirstCellLine>
        <SubContent>{subSpansContent}</SubContent>
      </Cell>
      <Cell>
        <FirstCellLine data-align="right">
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
      <Cell>
        <FirstCellLine>
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
          <ErrorMessage>{error}</ErrorMessage>
        ) : sampleRate !== initialSampleRate ? (
          <SmallPrint>{t('previous: %s%%', initialSampleRate)}</SmallPrint>
        ) : null}
      </Cell>
    </TableRowWrapper>
  );
});

const SizingWrapper = styled('div')`
  max-height: 400px;
`;

const SmallPrint = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  line-height: 1.5;
  text-align: right;
`;

const Ellipsis = styled('span')`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ErrorMessage = styled('span')`
  color: ${p => p.theme.error};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  line-height: 1.5;
  text-align: right;
`;

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

const TableRowWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 165px 165px 152px;
  overflow: hidden;
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const Cell = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
  padding: ${space(1)} ${space(2)};
  min-width: 0;

  &[data-align='right'] {
    align-items: flex-end;
  }
`;

const HeaderCell = styled(Cell)`
  padding: ${space(2)};
`;

const FirstCellLine = styled('div')`
  display: flex;
  align-items: center;
  height: 32px;
  & > * {
    flex-shrink: 0;
  }
  &[data-align='right'] {
    justify-content: flex-end;
  }
  &[data-has-chevron='false'] {
    padding-left: ${space(2)};
  }
`;

const SubContent = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
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
      background: ${p => p.theme.backgroundSecondary};
    }
  }

  &[data-is-first-column] > div {
    margin-left: -${space(1)};
    padding-left: ${space(1)};
    border-top-left-radius: ${p => p.theme.borderRadius};
    border-bottom-left-radius: ${p => p.theme.borderRadius};
  }

  &[data-is-last-column] > div {
    margin-right: -${space(1)};
    padding-right: ${space(1)};
    border-top-right-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
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
  color: ${p => p.theme.subText};
`;

const SettingsButton = styled(LinkButton)`
  margin-left: ${space(0.5)};
  color: ${p => p.theme.subText};
  visibility: hidden;

  &:focus {
    visibility: visible;
  }
  ${Cell}:hover & {
    visibility: visible;
  }
`;

const TableHeader = styled(TableRowWrapper)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.backgroundSecondary};
  white-space: nowrap;
  line-height: 1;
  height: 45px;
`;
