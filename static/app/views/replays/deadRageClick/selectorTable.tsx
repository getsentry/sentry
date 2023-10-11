import {ReactNode, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import {PlatformIcon} from 'platformicons';

import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ColorOrAlias} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DeadRageSelectorItem, ReplayClickElement} from 'sentry/views/replays/types';

export interface UrlState {
  widths: string[];
}

export function getAriaLabel(str: string) {
  const pre = str.split('aria="')[1];
  if (!pre) {
    return '';
  }
  return pre.substring(0, pre.lastIndexOf('"]'));
}

function trimAttribute(elementAttribute, fullAlltribute) {
  return elementAttribute === '' ? '' : fullAlltribute;
}

export function constructSelector(element: ReplayClickElement) {
  const fullAlt = '[alt="' + element.alt + '"]';
  const alt = trimAttribute(element.alt, fullAlt);

  const fullAriaLabel = '[aria="' + element.aria_label + '"]';
  const ariaLabel = trimAttribute(element.aria_label, fullAriaLabel);

  const trimClass = element.class.filter(e => e !== '');
  const classWithPeriod = trimClass.join('.');
  const classNoPeriod = classWithPeriod.replace('.', '');
  const classes = trimAttribute(classNoPeriod, '.' + classWithPeriod);

  const id = trimAttribute(element.id, '#' + element.id);

  const fullRole = '[role="' + element.role + '"]';
  const role = trimAttribute(element.role, fullRole);

  const tag = element.tag;

  const fullTestId = '[data-test-id="' + element.testid + '"]';
  const testId = trimAttribute(element.testid, fullTestId);

  const fullTitle = '[title="' + element.title + '"]';
  const title = trimAttribute(element.title, fullTitle);

  const fullSelector =
    tag + id + classes + fullRole + fullAriaLabel + fullTestId + fullAlt + fullTitle;
  const selector = tag + id + classes + role + ariaLabel + testId + alt + title;
  return {fullSelector, selector};
}

export function hydratedSelectorData(data, clickType?): DeadRageSelectorItem[] {
  return data.map(d => ({
    ...(clickType
      ? {[clickType]: d[clickType]}
      : {
          count_dead_clicks: d.count_dead_clicks,
          count_rage_clicks: d.count_rage_clicks,
        }),
    dom_element: {
      fullSelector: constructSelector(d.element).fullSelector,
      selector: constructSelector(d.element).selector,
      projectId: d.project_id,
    },
    element: d.dom_element.split(/[#.]+/)[0],
    aria_label: getAriaLabel(d.dom_element),
    project_id: d.project_id,
  }));
}

export function transformSelectorQuery(selector: string) {
  return selector
    .replaceAll('"', `\\"`)
    .replaceAll('aria=', 'aria-label=')
    .replaceAll('testid=', 'data-test-id=')
    .replaceAll(':', '\\:')
    .replaceAll('*', '\\*');
}
interface Props {
  clickCountColumns: {key: string; name: string}[];
  clickCountSortable: boolean;
  data: DeadRageSelectorItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<any>;
  title?: ReactNode;
}

const BASE_COLUMNS: GridColumnOrder<string>[] = [
  {key: 'project_id', name: 'project'},
  {key: 'element', name: 'element'},
  {key: 'dom_element', name: 'selector'},
  {key: 'aria_label', name: 'aria label'},
];

export function ProjectInfo({id, isWidget}: {id: number; isWidget: boolean}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === id.toString());
  const platform = project?.platform;
  const slug = project?.slug;
  return isWidget ? (
    <WidgetProjectContainer>
      <Tooltip title={slug}>
        <PlatformIcon size={16} platform={platform ?? 'default'} />
      </Tooltip>
    </WidgetProjectContainer>
  ) : (
    <IndexProjectContainer>
      <PlatformIcon size={16} platform={platform ?? 'default'} />
      <TextOverflow>{slug}</TextOverflow>
    </IndexProjectContainer>
  );
}

export default function SelectorTable({
  clickCountColumns,
  data,
  isError,
  isLoading,
  location,
  title,
  clickCountSortable,
}: Props) {
  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: clickCountColumns[0].key, kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS.concat(clickCountColumns),
    location,
  });

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: clickCountSortable ? clickCountColumns : [],
      }),
    [currentSort, makeSortLinkGenerator, clickCountColumns, clickCountSortable]
  );

  const queryPrefix = currentSort.field.includes('count_dead_clicks') ? 'dead' : 'rage';

  const renderBodyCell = useCallback(
    (column, dataRow) => {
      const value = dataRow[column.key];
      switch (column.key) {
        case 'dom_element':
          return (
            <SelectorLink
              value={value.selector}
              selectorQuery={`${queryPrefix}.selector:"${transformSelectorQuery(
                value.fullSelector
              )}"`}
              projectId={value.projectId.toString()}
            />
          );
        case 'element':
        case 'aria_label':
          return <TextOverflow>{value}</TextOverflow>;
        case 'project_id':
          return <ProjectInfo id={value} isWidget={false} />;
        default:
          return renderClickCount<DeadRageSelectorItem>(column, dataRow);
      }
    },
    [queryPrefix]
  );

  const selectorEmptyMessage = (
    <MessageContainer>
      <Title>{t('No dead or rage clicks found')}</Title>
      <Subtitle>
        {t(
          "Once your users start clicking around, you'll see the top selectors that were dead or rage clicked here."
        )}
      </Subtitle>
    </MessageContainer>
  );

  return (
    <GridEditable
      error={isError}
      isLoading={isLoading}
      data={data ?? []}
      columnOrder={columns}
      emptyMessage={selectorEmptyMessage}
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: handleResizeColumn,
        renderHeadCell,
        renderBodyCell,
      }}
      location={location as Location<any>}
      title={title}
    />
  );
}

export function SelectorLink({
  value,
  selectorQuery,
  projectId,
}: {
  projectId: string;
  selectorQuery: string;
  value: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  return (
    <StyledTextOverflow>
      <Link
        to={{
          pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
          query: {
            ...location.query,
            query: selectorQuery,
            cursor: undefined,
            project: projectId,
          },
        }}
      >
        <StyledTooltip
          position="top-start"
          title={t('Search for replays with clicks on this selector')}
        >
          {value}
        </StyledTooltip>
      </Link>
    </StyledTextOverflow>
  );
}

function renderClickCount<T>(column: GridColumnOrder<string>, dataRow: T) {
  const color = column.key === 'count_dead_clicks' ? 'yellow300' : 'red300';

  return (
    <ClickColor color={color}>
      <IconCursorArrow size="xs" />
      {dataRow[column.key]}
    </ClickColor>
  );
}

const ClickColor = styled(TextOverflow)<{color: ColorOrAlias}>`
  color: ${p => p.theme[p.color]};
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(0.75)};
  align-items: center;
  justify-content: start;
`;

const StyledTextOverflow = styled(TextOverflow)`
  color: ${p => p.theme.blue300};
`;

const StyledTooltip = styled(Tooltip)`
  display: inherit;
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('div')`
  font-size: 24px;
`;

const MessageContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
  justify-items: center;
`;

const WidgetProjectContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.75)};
`;

const IndexProjectContainer = styled(WidgetProjectContainer)`
  padding-right: ${space(1)};
`;
