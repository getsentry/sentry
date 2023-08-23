import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Avatar from 'sentry/components/avatar';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import ScoreBar from 'sentry/components/scoreBar';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconClock} from 'sentry/icons/iconClock';
import {t, tct} from 'sentry/locale';
import {space, ValidSize} from 'sentry/styles/space';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {BrowserCell, OSCell} from 'sentry/views/replays/replayTable/tableCell';

import {UserParams} from '../types';

type Props = UserParams;

export function TransactionWidget({userKey, userValue}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const projectsHash = Object.fromEntries(projects.map(project => [project.id, project]));

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('event.type', 'transaction');
    conditions.addFilterValue(`user.${userKey}`, userValue);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'project_id',
          'last_seen()',
          'transaction',
          'failure_rate()',
          'tpm()',
          'count_unique(user)',
          'p95(transaction.duration)',
          'count_miserable(user)',
          'user_misery()',
          'count()',
          'browser.name',
          'browser.version',
          'os.name',
          'os.version',
        ],
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, '-p95_transaction_duration'),
      },
      location
    );
  }, [location, userKey, userValue]);

  const {isLoading, data, error} = useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 3,
  });

  const bars = 10;
  const palette = new Array(bars).fill([CHART_PALETTE[0][0]]);

  return (
    <TransactionPanel>
      <PanelHeader>{t('Slowest Transactions (p95)')}</PanelHeader>
      {isLoading ? (
        <Placeholder height="189px" />
      ) : error ? (
        <LoadingError />
      ) : (
        <div>
          {!data?.data.length ? (
            <EmptyTable>{t('No transaction data')}</EmptyTable>
          ) : (
            <Table>
              {data.data.map(dataRow => {
                const project = projectsHash[dataRow.project_id];
                const link = `/performance/summary/?${qs.stringify({
                  project: dataRow.project_id,
                  transaction: dataRow.transaction,
                  query: `user.${userKey}:${userValue}`,
                })}`;
                const duration = Number(dataRow['p95(transaction.duration)']);
                const failureRate = Number(dataRow['failure_rate()']);

                return (
                  <Fragment key={dataRow.transaction}>
                    <Cols key={`${dataRow.transaction}-data`}>
                      <Title>
                        <Link to={link}>{dataRow.transaction}</Link>
                      </Title>
                      <SubRow gap={1}>
                        <Row gap={0.5}>
                          <SmallOSCell
                            replay={
                              {
                                os: {
                                  name: dataRow['os.name'],
                                  version: dataRow['os.version'],
                                },
                              } as any
                            }
                          />
                          <SmallBrowserCell
                            replay={
                              {
                                browser: {
                                  name: dataRow['browser.name'],
                                  version: dataRow['browser.version'],
                                },
                              } as any
                            }
                          />
                        </Row>
                        <Row gap={0.5}>
                          {project ? <Avatar size={12} project={project} /> : null}
                          {project ? project.slug : null}
                        </Row>
                        <Row gap={0.5}>
                          <IconClock color="gray300" size="xs" />
                          <TextOverflow>
                            <TimeSince date={dataRow['last_seen()']} />
                          </TextOverflow>
                        </Row>
                      </SubRow>
                    </Cols>
                    <Cols>
                      <NumberContainer>
                        <StyledDuration
                          ms={duration}
                          seconds={duration / 1000}
                          fixedDigits={2}
                          abbreviation
                        />
                      </NumberContainer>
                    </Cols>
                    <Cols>
                      <Tooltip
                        title={tct('Failure rate of [failureRate]', {
                          failureRate: formatPercentage(failureRate),
                        })}
                        containerDisplayMode="block"
                      >
                        <ScoreBar
                          size={20}
                          score={Math.round(failureRate * palette.length)}
                          palette={palette}
                          radius={0}
                        />
                      </Tooltip>
                    </Cols>
                  </Fragment>
                );
              })}
            </Table>
          )}
        </div>
      )}
    </TransactionPanel>
  );
}

const Table = styled('div')`
  display: grid;
  overflow: hidden;
  gap: ${space(1.5)};
  grid-template-columns: auto 1fr 1fr;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const EmptyTable = styled('div')`
  padding: ${space(1)} ${space(2)};
`;

const Cols = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  width: 100%;
`;

const Row = styled('div')<{gap: ValidSize; minWidth?: number}>`
  display: flex;
  gap: ${p => space(p.gap)};
  align-items: center;
  ${p => (p.minWidth ? `min-width: ${p.minWidth}px;` : '')}
`;

const SubRow = styled(Row)`
  color: ${p => p.theme.gray300};
`;

const TransactionPanel = styled(Panel)`
  overflow: hidden;
`;

const Title = styled('div')`
  display: grid;
  gap: ${space(0.25)};

  a {
    ${p => p.theme.overflowEllipsis};
  }
`;

const StyledDuration = styled(Duration)<{ms?: number}>`
  ${p =>
    p.ms &&
    (p.ms <= 1500
      ? `color: ${p.theme.green300};`
      : p.ms <= 5000
      ? `color: ${p.theme.yellow300};`
      : `color: ${p.theme.red300};`)}
`;

const SmallOSCell = styled(OSCell)`
  padding: 0;
`;

const SmallBrowserCell = styled(BrowserCell)`
  padding: 0;
`;
