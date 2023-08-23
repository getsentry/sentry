import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Avatar from 'sentry/components/avatar';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconClock} from 'sentry/icons/iconClock';
import {IconFire} from 'sentry/icons/iconFire';
import {t} from 'sentry/locale';
import {space, ValidSize} from 'sentry/styles/space';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {BrowserCell, OSCell} from 'sentry/views/replays/replayTable/tableCell';
import Count from 'sentry/components/count';

interface Props {
  userId: string;
}

export function ErrorWidget({userId}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const projectsHash = Object.fromEntries(projects.map(project => [project.id, project]));

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('event.type', 'error');
    conditions.addFilterValue('user.id', userId);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'issue.id',
          'message',
          'project_id',
          'count()',
          'platform.name',
          'message',
          'issue',
          'last_seen()',
          'error.type',
          'browser.name',
          'browser.version',
          'os.name',
          'os.version',
        ],
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, '-last_seen'),
      },
      location
    );
  }, [location, userId]);

  const {isLoading, data, error} = useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 3,
  });

  return (
    <TransactionPanel>
      <PanelHeader>{t('Recent Errors')}</PanelHeader>
      <div>
        {isLoading ? (
          <Placeholder height="189px" />
        ) : error ? (
          <LoadingError />
        ) : !data?.data.length ? (
          <EmptyTable>{t('No error data')}</EmptyTable>
        ) : (
          <Table>
            {data.data.map(dataRow => {
              const issueId = dataRow['issue.id'];
              const project = projectsHash[dataRow.project_id];
              const link = `/issues/${issueId}/events/${dataRow.id}/?${qs.stringify({
                project: dataRow.project_id,
                query: `user.id:${userId}`,
              })}`;

              return (
                <Fragment key={issueId}>
                  <Cols key={`${issueId}-data`}>
                    <TextOverflow>
                      <Link to={link}>{dataRow.message}</Link>
                    </TextOverflow>
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
                        <Link to={link}>{dataRow.issue}</Link>
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
                      <IconFire />
                      <Count value={dataRow['count()']} />
                    </NumberContainer>
                  </Cols>
                </Fragment>
              );
            })}
          </Table>
        )}
      </div>
    </TransactionPanel>
  );
}

const Table = styled('div')`
  display: grid;
  overflow: hidden;
  gap: ${space(1.5)};
  grid-column-gap: ${space(3)};
  grid-template-columns: auto max-content;
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
  overflow: hidden;
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

const NumberContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  color: ${p => p.theme.error};
  gap: ${space(0.25)};
`;

const SmallOSCell = styled(OSCell)`
  padding: 0;
`;

const SmallBrowserCell = styled(BrowserCell)`
  padding: 0;
`;
