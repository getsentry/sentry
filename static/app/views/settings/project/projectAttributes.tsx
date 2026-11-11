import {IconSentry} from '@sentry/icons/sentry';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {createSerializer, parseAsString, useQueryStates} from 'nuqs';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Feature} from 'sentry/components/acl/feature';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {getNextSort} from 'sentry/components/tables/getNextSort';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseCursor} from 'sentry/utils/cursor';
import type {Sort} from 'sentry/utils/discover/fields';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {getPaginationProps} from 'sentry/utils/pagination';
import {encodeSort} from 'sentry/utils/queryString';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {
  ATTRIBUTE_VALUE_TYPES,
  ATTRIBUTES_STATS_PERIOD,
  type Attribute,
  type AttributeDataset,
} from './projectAttributesCommon';
import {useProjectSettingsOutlet} from './projectSettingsLayout';

const ATTRIBUTES_PER_PAGE = 25;

const DATASET_LABELS: Record<AttributeDataset, string> = {
  spans: t('Spans'),
  logs: t('Logs'),
  tracemetrics: t('Metrics'),
};

const ALL_OPTION_VALUE = 'all';

const DATASET_OPTIONS = [
  {value: ALL_OPTION_VALUE, label: t('All')},
  {value: 'spans', label: DATASET_LABELS.spans},
  {value: 'logs', label: DATASET_LABELS.logs},
  {value: 'tracemetrics', label: DATASET_LABELS.tracemetrics},
];

const SORT_FIELDS = ['name', 'type', 'datasets', 'description'] as const;

type SortField = (typeof SORT_FIELDS)[number];

const DEFAULT_SORT: Sort = {field: 'name', kind: 'asc'};

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(200px, 2fr)'},
  {key: 'type', width: 'max-content'},
  {key: 'datasets', width: 'max-content'},
  {key: 'description', width: 'minmax(200px, 3fr)'},
];

const attributesQueryParsers = {
  cursor: parseAsString,
  sort: parseAsSort,
  dataset: parseAsString,
  type: parseAsString,
  search: parseAsString.withDefault(''),
};

const serializeAttributesQuery = createSerializer(attributesQueryParsers);

function decodeOption(value: string | null, options: Array<{value: string}>) {
  return options.find(option => option.value === value)?.value ?? ALL_OPTION_VALUE;
}

function ProjectAttributesSettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const [attributesQuery, setAttributesQuery] = useQueryStates(attributesQueryParsers);

  const typeOptions = [
    {value: ALL_OPTION_VALUE, label: t('All')},
    ...Object.keys(ATTRIBUTE_VALUE_TYPES)
      .filter(
        type =>
          type !== 'array' ||
          organization.features.includes('trace-item-array-query-support')
      )
      .map(type => ({value: type, label: type})),
  ];

  const cursor = attributesQuery.cursor || undefined;
  const sortParam = attributesQuery.sort;
  const sort =
    sortParam && SORT_FIELDS.some(sortField => sortField === sortParam.field)
      ? sortParam
      : DEFAULT_SORT;
  const dataset = decodeOption(attributesQuery.dataset, DATASET_OPTIONS);
  const type = decodeOption(attributesQuery.type, typeOptions);
  const search = attributesQuery.search;

  function updateQuery(
    query: Partial<Record<'dataset' | 'search' | 'type', string | null>>
  ) {
    setAttributesQuery({cursor: null, ...query}, {history: 'push'});
  }

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<Attribute[]>()(
      '/organizations/$organizationIdOrSlug/trace-items/attributes/merged/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          attributeType: type === ALL_OPTION_VALUE ? undefined : type,
          cursor,
          dataset: dataset === ALL_OPTION_VALUE ? undefined : dataset,
          expand: 'context',
          search: search || undefined,
          per_page: ATTRIBUTES_PER_PAGE,
          project: [project.id],
          sort: encodeSort(sort),
          statsPeriod: ATTRIBUTES_STATS_PERIOD,
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
    placeholderData: keepPreviousData,
  });

  const attributes = data?.json;
  const totalHits = Number(data?.headers['X-Hits'] ?? 0);
  const offset = parseCursor(cursor)?.offset ?? 0;

  const caption = attributes?.length
    ? tct('[start]-[end] of [total]', {
        start: (offset + 1).toLocaleString(),
        end: (offset + attributes.length).toLocaleString(),
        total: totalHits.toLocaleString(),
      })
    : undefined;

  return (
    <SentryDocumentTitle title={t('Attributes')} projectSlug={project.slug}>
      <SettingsPageHeader
        title={{
          type: 'page-title',
          label: t('Attributes'),
          trailingActions: {type: 'badge', element: <FeatureBadge type="beta" />},
        }}
        subtitle={t(
          'Browse the attributes sent with your logs, metrics, and spans in the last 14 days.'
        )}
      />
      <Flex gap="md" wrap="wrap" paddingBottom="md">
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Dataset')} />
          )}
          value={dataset}
          options={DATASET_OPTIONS}
          onChange={option =>
            updateQuery({
              dataset: option.value === ALL_OPTION_VALUE ? null : option.value,
            })
          }
        />
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Type')} />
          )}
          value={type}
          options={typeOptions}
          onChange={option =>
            updateQuery({
              type: option.value === ALL_OPTION_VALUE ? null : option.value,
            })
          }
        />
        <Container flexGrow={1}>
          <SearchBar
            query={search}
            placeholder={t('Search attribute names or descriptions')}
            onSearch={query => updateQuery({search: query})}
          />
        </Container>
      </Flex>
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SortableHeaderCell field="name" sort={sort}>
              {t('Name')}
            </SortableHeaderCell>
            <SortableHeaderCell field="type" sort={sort}>
              {t('Type')}
            </SortableHeaderCell>
            <SortableHeaderCell field="datasets" sort={sort}>
              {t('Datasets')}
            </SortableHeaderCell>
            <SortableHeaderCell field="description" sort={sort}>
              {t('Description')}
            </SortableHeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending && <SimpleTable.Loading />}
        {isError && <SimpleTable.Error onRetry={refetch} />}
        {attributes?.length === 0 && (
          <SimpleTable.Empty>{t('No attributes found')}</SimpleTable.Empty>
        )}
        {attributes?.map(attribute => (
          <AttributeRow
            key={`${attribute.name}:${attribute.attributeType}:${attribute.attributeSource.source_type}`}
            attribute={attribute}
          />
        ))}
      </SimpleTable>
      <Pagination {...getPaginationProps(data?.headers.Link)} caption={caption} />
    </SentryDocumentTitle>
  );
}

function SortableHeaderCell({
  children,
  field,
  sort,
}: {
  children: React.ReactNode;
  field: SortField;
  sort: Sort;
}) {
  const location = useLocation();
  return (
    <SimpleTable.HeaderCell
      sort={sort.field === field ? sort.kind : undefined}
      to={{
        pathname: location.pathname,
        search: serializeAttributesQuery(location.search, {
          cursor: null,
          sort: getNextSort(field, sort, 'asc'),
        }),
        hash: location.hash,
      }}
    >
      {children}
    </SimpleTable.HeaderCell>
  );
}

function AttributeRow({attribute}: {attribute: Attribute}) {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Flex align="center" gap="sm" wrap="wrap">
          <Link
            to={{
              pathname: `/settings/${organization.slug}/projects/${project.slug}/attributes/${attribute.attributeType}/${encodeURIComponent(attribute.name)}/`,
              query: {source: attribute.attributeSource.source_type},
            }}
          >
            <Text monospace variant="inherit" wordBreak="break-all">
              {attribute.name}
            </Text>
          </Link>
          {attribute.attributeSource.source_type === 'sentry' && (
            <Tooltip title={t('Added by Sentry')} skipWrapper>
              <IconSentry size="xs" aria-label={t('Added by Sentry')} />
            </Tooltip>
          )}
          {attribute.context?.isDeprecated && (
            <Tag variant="warning">{t('Deprecated')}</Tag>
          )}
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <TypeBadge valueType={ATTRIBUTE_VALUE_TYPES[attribute.attributeType]} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex gap="xs" wrap="wrap">
          {attribute.datasets.map(dataset => (
            <Tag key={dataset} variant="muted">
              {DATASET_LABELS[dataset]}
            </Tag>
          ))}
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {attribute.context?.brief ? (
          <Text>
            <MarkedText as="span" inline text={attribute.context.brief} />
          </Text>
        ) : (
          <Text variant="muted">—</Text>
        )}
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

export default function ProjectAttributes() {
  return (
    <Feature features="attribute-management">
      <ProjectAttributesSettings />
    </Feature>
  );
}
