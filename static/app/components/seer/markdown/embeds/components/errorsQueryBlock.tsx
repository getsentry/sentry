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

import {ErrorsQueryLink} from './errorsQueryLink';
import {
  buildErrorsEventView,
  type ErrorsQueryData,
  type ErrorsQueryKind,
} from './errorsQueryUtils';

const ROW_LIMIT = 5;

interface ErrorsQueryBlockProps {
  data: ErrorsQueryData;
  kind: ErrorsQueryKind;
}

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

export function ErrorsQueryBlock({data, kind}: ErrorsQueryBlockProps) {
  const organization = useOrganization();
  const eventView = buildErrorsEventView(data, kind);
  const fields = eventView.getFields();
  const query = useQuery({
    ...apiOptions.as<TableData>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        ...eventView.generateQueryStringObject(),
        per_page: ROW_LIMIT,
        referrer: 'seer-errors-query-embed',
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
      as="section"
      background="primary"
      border="primary"
      data-test-id={`seer-errors-query-${kind}-embed`}
      margin="lg 0"
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="md">
        <Flex align="center" gap="md" justify="between">
          <ErrorsQueryLink data={data} kind={kind} />
          <Tag variant="muted">{kind === 'aggregate' ? t('Aggregate') : t('Events')}</Tag>
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
            <SimpleTable.Empty>{t('Unable to load errors')}</SimpleTable.Empty>
          ) : query.data.data.length === 0 ? (
            <SimpleTable.Empty>{t('No matching errors')}</SimpleTable.Empty>
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
