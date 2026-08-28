import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {formatNumber} from 'sentry/utils/number/formatNumber';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SpansQueryLink} from './spansQueryLink';
import {
  buildSpansEventView,
  getSpansQueryFields,
  type SpansQueryData,
} from './spansQueryUtils';

const ROW_LIMIT = 5;

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  if (typeof value === 'number') {
    return String(formatNumber(value));
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }

  return JSON.stringify(value) ?? '—';
}

export function SpansQueryBlock({data}: {data: SpansQueryData}) {
  const organization = useOrganization();
  const eventView = buildSpansEventView(data);
  const fields = getSpansQueryFields(data);
  const query = useQuery({
    ...apiOptions.as<TableData>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        ...eventView.generateQueryStringObject(),
        per_page: ROW_LIMIT,
        referrer: 'seer-spans-query-embed',
      },
      staleTime: 30_000,
    }),
    retry: false,
  });
  const columns = fields.map((field, index) => ({
    key: field,
    width: index === 0 ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)',
  }));

  return (
    <Container
      background="primary"
      border="primary"
      data-test-id={`seer-spans-query-${data.mode}-embed`}
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="md">
        <Flex align="center" gap="md" justify="between">
          <SpansQueryLink data={data} />
          <Tag variant="muted">
            {data.mode === 'aggregate' ? t('Aggregate') : t('Spans')}
          </Tag>
        </Flex>
        <SimpleTable
          columns={columns}
          header={
            <SimpleTable.HeaderRow>
              {fields.map(field => (
                <SimpleTable.HeaderCell key={field}>
                  <Text ellipsis>{field}</Text>
                </SimpleTable.HeaderCell>
              ))}
            </SimpleTable.HeaderRow>
          }
        >
          {query.isPending ? (
            <SimpleTable.Loading />
          ) : query.isError ? (
            <SimpleTable.Empty>{t('Unable to load spans')}</SimpleTable.Empty>
          ) : query.data.data.length === 0 ? (
            <SimpleTable.Empty>{t('No matching spans')}</SimpleTable.Empty>
          ) : (
            query.data.data.slice(0, ROW_LIMIT).map((row, rowIndex) => (
              <SimpleTable.Row key={row.id ?? rowIndex}>
                {fields.map(field => (
                  <SimpleTable.RowCell key={field}>
                    <Text ellipsis>
                      {formatCellValue(row[field] ?? row[getAggregateAlias(field)])}
                    </Text>
                  </SimpleTable.RowCell>
                ))}
              </SimpleTable.Row>
            ))
          )}
        </SimpleTable>
      </Stack>
    </Container>
  );
}
