import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import Feature from 'sentry/components/acl/feature';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {getNextSort} from 'sentry/components/tables/getNextSort';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconSentry} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseCursor} from 'sentry/utils/cursor';
import type {Sort} from 'sentry/utils/discover/fields';
import {FieldValueType} from 'sentry/utils/fields';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {decodeScalar, decodeSorts, encodeSort} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import type {
  TraceItemAttribute,
  TraceItemAttributeType,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

type AttributeDataset = 'spans' | 'logs' | 'tracemetrics';

interface Attribute extends Pick<
  TraceItemAttribute,
  'attributeSource' | 'attributeType' | 'name'
> {
  datasets: AttributeDataset[];
  context?: {
    brief?: string;
    isDeprecated?: boolean;
  };
}

const ATTRIBUTE_VALUE_TYPES: Record<TraceItemAttributeType, FieldValueType> = {
  string: FieldValueType.STRING,
  number: FieldValueType.NUMBER,
  boolean: FieldValueType.BOOLEAN,
  array: FieldValueType.ARRAY,
};

const ATTRIBUTES_PER_PAGE = 25;
const ATTRIBUTES_STATS_PERIOD = '14d';

const DATASET_LABELS: Record<AttributeDataset, string> = {
  spans: t('Spans'),
  logs: t('Logs'),
  tracemetrics: t('Metrics'),
};

const SORT_FIELDS = ['name', 'type', 'datasets', 'description'] as const;

type SortField = (typeof SORT_FIELDS)[number];

const DEFAULT_SORT: Sort = {field: 'name', kind: 'asc'};

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(200px, 2fr)'},
  {key: 'type', width: 'max-content'},
  {key: 'datasets', width: 'max-content'},
  {key: 'description', width: 'minmax(200px, 3fr)'},
];

function ProjectAttributesSettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const location = useLocation();

  const cursor = decodeScalar(location.query.cursor);
  const sort =
    decodeSorts(location.query.sort).find(({field}) =>
      SORT_FIELDS.some(sortField => sortField === field)
    ) ?? DEFAULT_SORT;

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<Attribute[]>()(
      '/organizations/$organizationIdOrSlug/trace-items/attributes/merged/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          cursor,
          expand: 'context',
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
        title={t('Attributes')}
        subtitle={t(
          'Browse the attributes sent with your logs, metrics, and spans in the last 14 days.'
        )}
      />
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
      <Pagination pageLinks={data?.headers.Link} caption={caption} />
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
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          sort: encodeSort(getNextSort(field, sort, 'asc')),
        },
      }}
    >
      {children}
    </SimpleTable.HeaderCell>
  );
}

function AttributeRow({attribute}: {attribute: Attribute}) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Flex align="center" gap="sm" wrap="wrap">
          <Text monospace wordBreak="break-all">
            {attribute.name}
          </Text>
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
