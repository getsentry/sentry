import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {useQueryState} from 'nuqs';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {DateTime} from 'sentry/components/dateTime';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps, useGetPaginationCaption} from 'sentry/utils/pagination';
import {useOrganization} from 'sentry/utils/useOrganization';
import {automationFireHistoryApiOptions} from 'sentry/views/automations/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

const HISTORY_COLUMNS: TableColumnConfig[] = [
  {key: 'lastTriggered', width: '2fr'},
  {key: 'monitor', width: '2.5fr'},
  {key: 'issue', width: '3.5fr'},
  {key: 'alerts', width: '1fr'},
];

const DEFAULT_HISTORY_PER_PAGE = 10;

type Props = {
  automationId: string;
  query?: Record<string, any>;
};

function Skeletons() {
  return (
    <Fragment>
      {Array.from({length: DEFAULT_HISTORY_PER_PAGE}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

export function AutomationHistoryList({automationId, query}: Props) {
  const limit = DEFAULT_HISTORY_PER_PAGE;
  const org = useOrganization();
  const getPaginationCaption = useGetPaginationCaption();
  const [cursor, setCursor] = useQueryState('cursor', {history: 'push'});

  const {data, isLoading, isError} = useQuery({
    ...automationFireHistoryApiOptions({
      organization: org,
      automationId,
      cursor: cursor ?? undefined,
      limit,
      query,
    }),
    select: selectJsonWithHeaders,
  });

  const fireHistory = data?.json ?? [];
  const pageLinks = data?.headers.Link;
  const totalCountInt = data?.headers['X-Hits'] ?? 0;

  const paginationCaption =
    isLoading || !data?.json
      ? undefined
      : getPaginationCaption({
          cursor,
          limit,
          pageLength: data.json.length,
          total: totalCountInt,
        });

  return (
    <Fragment>
      <SimpleTable
        columns={HISTORY_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Last Triggered')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Monitor')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Alerts')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isLoading && <Skeletons />}
        {isError && <SimpleTable.Error />}
        {!isLoading && !isError && fireHistory.length === 0 && (
          <SimpleTable.Empty>{t('No history found')}</SimpleTable.Empty>
        )}
        {fireHistory.map((row, index) => (
          <SimpleTable.Row key={index}>
            <SimpleTable.RowCell>
              <DateTime date={row.lastTriggered} timeZone />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {row.detector ? (
                <StyledLink to={makeMonitorDetailsPathname(org.slug, row.detector.id)}>
                  <TruncatedText>{row.detector.name}</TruncatedText>
                </StyledLink>
              ) : (
                '—'
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <StyledLink
                to={{
                  pathname: `/organizations/${org.slug}/issues/${row.group.id}/`,
                  query: {project: row.group.project.id},
                }}
              >
                <Flex gap="xs" align="center">
                  <PlatformIcon
                    platform={row.group.project.platform ?? 'default'}
                    size={16}
                    alt=""
                  />
                  <TruncatedText>
                    {row.group.title ? row.group.title : `#${row.group.id}`}
                  </TruncatedText>
                </Flex>
              </StyledLink>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>{row.count}</SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTable>
      <StyledPagination
        onCursor={newCursor => {
          setCursor(newCursor ?? null);
        }}
        {...getPaginationProps(pageLinks)}
        caption={paginationCaption}
      />
    </Fragment>
  );
}

const StyledLink = styled(Link)`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
`;

const TruncatedText = styled('span')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
