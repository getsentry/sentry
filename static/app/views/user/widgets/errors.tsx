import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Avatar from 'sentry/components/avatar';
import Count from 'sentry/components/count';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconClock} from 'sentry/icons/iconClock';
import {t} from 'sentry/locale';
import {space, ValidSize} from 'sentry/styles/space';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

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
          'title',
          'project_id',
          'count()',
          'platform.name',
          'message',
          'issue',
          'last_seen()',
          'error.type',
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

  if (isLoading) {
    return <Placeholder height="232px" />;
  }

  if (error) {
    return <LoadingError />;
  }

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
              const link = `/issues/${issueId}/events/?${qs.stringify({
                project: dataRow.project_id,
                query: `user.id:${userId}`,
              })}`;

              return (
                <Fragment key={issueId}>
                  <Cols key={`${issueId}-data`}>
                    <Title>
                      <Link to={link}>{dataRow.issue}</Link>
                      <div>{dataRow.title}</div>
                    </Title>
                    <SubRow gap={1}>
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
                      <Count value={dataRow['count()']} /> events
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
  grid-template-columns: auto 1fr;
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
  grid-template-columns: max-content auto;
  gap: ${space(1)};

  div {
    ${p => p.theme.overflowEllipsis};
  }
`;
