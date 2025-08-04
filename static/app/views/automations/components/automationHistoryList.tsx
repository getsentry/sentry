import {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useAutomationFireHistoryQuery} from 'sentry/views/automations/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

const DEFAULT_HISTORY_PER_PAGE = 10;

type Props = {
  automationId: string;
  emptyMessage?: string;
  limit?: number;
  query?: string;
};

function Skeletons() {
  return (
    <Fragment>
      {Array.from({length: DEFAULT_HISTORY_PER_PAGE}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="type">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="last-issue">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell data-column-name="owner">
            <Placeholder height="20px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

export default function AutomationHistoryList({
  automationId,
  limit = DEFAULT_HISTORY_PER_PAGE,
  query,
  emptyMessage = t('No history found'),
}: Props) {
  const org = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const cursor =
    typeof location.query.cursor === 'string' ? location.query.cursor : undefined;

  const {
    data: fireHistory = [],
    isLoading,
    isError,
    getResponseHeader,
  } = useAutomationFireHistoryQuery(
    {automationId, limit, cursor, query},
    {enabled: !!automationId}
  );

  const pageLinks = getResponseHeader?.('Link');

  return (
    <Fragment>
      <SimpleTableWithColumns>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Time Sent')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Monitor')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Alerts')}</SimpleTable.HeaderCell>
        </SimpleTable.Header>
        {isLoading && <Skeletons />}
        {isError && <LoadingError />}
        {!isLoading && !isError && fireHistory.length === 0 && (
          <SimpleTable.Empty>{emptyMessage}</SimpleTable.Empty>
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
                t('Unknown detector')
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <StyledLink to={`/issues/${row.group.id}`}>
                <Flex gap="xs" align="center">
                  <PlatformIcon platform={row.group.platform} size={16} />
                  <TruncatedText>
                    {row.group.title ? row.group.title : `#${row.group.id}`}
                  </TruncatedText>
                </Flex>
              </StyledLink>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>{row.count}</SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTableWithColumns>
      <StyledPagination
        onCursor={newCursor => {
          navigate({
            pathname: location.pathname,
            query: {
              ...location.query,
              cursor: newCursor,
            },
          });
        }}
        pageLinks={pageLinks}
      />
    </Fragment>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 2fr 2.5fr 3.5fr 1fr;
`;

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
