import {useMemo} from 'react';
import styled from '@emotion/styled';
import first from 'lodash/first';

import Pagination from 'sentry/components/pagination';
import {PageContent} from 'sentry/styles/organization';
import type {Group} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT, REPLAY_LIST_FIELDS} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = {
  group: Group;
  replayIds: string[];
};

const GroupReplays = ({group, replayIds}: Props) => {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();
  const {project} = group;

  const eventView = useMemo(() => {
    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: REPLAY_LIST_FIELDS,
        projects: [Number(project.id)],
        query: `id:[${String(replayIds)}]`,
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location, project.id, replayIds]);

  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    organization,
    eventView,
  });

  return (
    <StyledPageContent>
      <ReplayTable
        isFetching={isFetching}
        replays={replays}
        showProjectColumn={false}
        sort={first(eventView.sorts)}
        fetchError={fetchError}
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
