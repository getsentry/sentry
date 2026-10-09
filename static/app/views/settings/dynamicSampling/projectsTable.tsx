import type React from 'react';
import {Fragment, memo, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {IconSettings} from '@sentry/icons/settings';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';
import {useOrganization} from 'sentry/utils/useOrganization';
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
  onChange?: (projectId: string, value: string) => void;
}

const COLUMNS: TableColumnConfig[] = [
  {key: 'project', width: 'minmax(0, 1fr)'},
  {key: 'accepted', width: '165px'},
  {key: 'stored', width: '165px'},
  {key: 'rate', width: '152px'},
];

const BASE_ROW_HEIGHT = 77;
const MAX_SCROLL_HEIGHT = 400;

export function ProjectsTable({
  items,
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
  const [expandedItems, setExpandedItems] = useState(new Set());
  const tableRef = useRef<HTMLTableElement>(null);

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

  const getItemKey = useCallback(
    (index: number) => sortedItems[index]?.project.id ?? index,
    [sortedItems]
  );

  const {paddingBottom, paddingTop, virtualItems, virtualizer} = useVirtualRows({
    count: isLoading ? 0 : sortedItems.length,
    getScrollElement: () => tableRef.current,
    estimateSize: index =>
      sortedItems[index]?.isExpanded
        ? BASE_ROW_HEIGHT + (sortedItems[index].subProjects.length + 1) * 24
        : BASE_ROW_HEIGHT,
    getItemKey,
  });

  return (
    <FlushTable
      aria-label={t('Projects')}
      columns={COLUMNS}
      customSections
      maxHeight={`${MAX_SCROLL_HEIGHT}px`}
      ref={tableRef}
      scrollable
    >
      <SimpleTable.Head sticky>
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Originating Project')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell
            align="right"
            handleSortClick={handleTableSort}
            sort={tableSort}
          >
            {t('Accepted Spans')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right">
            {period === '24h' ? t('Stored Spans (24h)') : t('Stored Spans (30d)')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right">{rateHeader}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      </SimpleTable.Head>
      <SimpleTable.Body style={{paddingBottom, paddingTop}}>
        {isLoading ? (
          <SimpleTable.Loading />
        ) : items.length === 0 ? (
          <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>
        ) : (
          virtualItems.map(virtualRow => {
            const item = sortedItems[virtualRow.index];
            if (!item) {
              return null;
            }
            return (
              <TableRow
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                canEdit={canEdit}
                onChange={onChange}
                toggleExpanded={handleToggleItemExpanded}
                hasAccess={hasAccess}
                {...item}
              />
            );
          })
        )}
      </SimpleTable.Body>
    </FlushTable>
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
const TableRow = memo(function TableRowImpl({
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
  onChange,
  ref,
  'data-index': dataIndex,
}: {
  count: number;
  'data-index': number;
  hasAccess: boolean;
  initialSampleRate: string;
  isExpanded: boolean;
  ownCount: number;
  project: Project;
  ref: React.Ref<HTMLTableRowElement>;
  sampleRate: string;
  subProjects: SubProject[];
  toggleExpanded: (id: string) => void;
  canEdit?: boolean;
  error?: string;
  onChange?: (projectId: string, value: string) => void;
}) {
  const organization = useOrganization();

  const isExpandable = subProjects.length > 0;
  const hasProjectAccess = hasEveryAccess(['project:write'], {organization, project});

  const subProjectContent = getSubProjectContent(project.slug, subProjects, isExpanded);
  const subSpansContent = getSubSpansContent(ownCount, subProjects, isExpanded);

  const permissionTooltip = hasAccess
    ? undefined
    : t('You do not have permission to change the sample rate.');

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(project.id, event.target.value);
    },
    [onChange, project.id]
  );

  const storedSpans = Math.floor(count * parsePercent(sampleRate));
  return (
    <SimpleTable.Row ref={ref} data-index={dataIndex}>
      <SimpleTable.RowCell direction="column" align="stretch" alignSelf="stretch">
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
              variant="link"
              icon={<IconSettings />}
              to={`/settings/${organization.slug}/projects/${project.slug}/performance/`}
            />
          )}
        </FirstCellLine>
        <SubProjects data-is-first-column>{subProjectContent}</SubProjects>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell direction="column" align="end" alignSelf="stretch">
        <FirstCellLine align="center" height="32px" justify="end">
          {formatAbbreviatedNumber(count)}
        </FirstCellLine>
        <SubContent>{subSpansContent}</SubContent>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell direction="column" align="end" alignSelf="stretch">
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
      </SimpleTable.RowCell>
      <SimpleTable.RowCell
        direction="column"
        align="stretch"
        alignSelf="stretch"
        gap="xs"
      >
        <FirstCellLine align="center" height="32px">
          <Tooltip disabled={!permissionTooltip} title={permissionTooltip}>
            <PercentInput
              type="number"
              disabled={!canEdit || !hasAccess}
              onChange={handleChange}
              size="sm"
              value={sampleRate ?? ''}
              aria-label={t('Sample rate for %s', project.slug)}
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
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
});

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
    margin-left: -${p => p.theme.space.xl};
    padding-left: ${p => p.theme.space.xl};
    margin-right: -${p => p.theme.space.xl};
    padding-right: ${p => p.theme.space.xl};
    text-overflow: ellipsis;
    overflow: hidden;

    &:nth-child(odd) {
      background: ${p => p.theme.tokens.background.secondary};
    }
  }

  &[data-is-first-column] > div {
    margin-left: -${p => p.theme.space.md};
    padding-left: ${p => p.theme.space.md};
    border-top-left-radius: ${p => p.theme.radius.md};
    border-bottom-left-radius: ${p => p.theme.radius.md};
  }

  &[data-is-last-column] > div {
    margin-right: -${p => p.theme.space.md};
    padding-right: ${p => p.theme.space.md};
    border-top-right-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }
`;

const SubProjects = styled(SubContent)`
  text-align: left;
  margin-left: ${p => p.theme.space.xl};
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
  margin-right: ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.secondary};
`;

const SettingsButton = styled(LinkButton)`
  margin-left: ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.secondary};
  visibility: hidden;

  &:focus {
    visibility: visible;
  }
  tr:hover & {
    visibility: visible;
  }
`;

const FlushTable = styled(SimpleTable)`
  border: 0;
  border-radius: 0;

  > thead > tr {
    border-radius: 0;
  }
`;
