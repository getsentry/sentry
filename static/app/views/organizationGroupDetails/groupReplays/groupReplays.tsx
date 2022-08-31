import {useMemo} from 'react';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import {PageContent} from 'sentry/styles/organization';
import type {Group} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayList, {
  DEFAULT_SORT,
  REPLAY_LIST_FIELDS,
} from 'sentry/utils/replays/hooks/useReplayList';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = {
  group: Group;
};

const GroupReplays = ({group}: Props) => {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();
  const params = useParams();
  const {project} = group;

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValues('issue.id', params.groupId);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: REPLAY_LIST_FIELDS,
        projects: [Number(project.id)],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location, project.id, params.groupId]);

  const {replays, pageLinks, isFetching} = useReplayList({
    organization,
    eventView,
  });

  return (
    <StyledPageContent>
      <ReplayTable
        isFetching={isFetching}
        origin="issues"
        replays={replays}
        showProjectColumn={false}
        sort={eventView.sorts[0]}
      />
      <Pagination pageLinks={pageLinks} />
    </StyledPageContent>
  );
};

const StyledPageContent = styled(PageContent)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

export default GroupReplays;
