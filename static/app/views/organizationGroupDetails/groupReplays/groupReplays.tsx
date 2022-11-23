import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import first from 'lodash/first';

import Pagination from 'sentry/components/pagination';
import {PageContent} from 'sentry/styles/organization';
import type {Group, Organization} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT, REPLAY_LIST_FIELDS} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import useApi from 'sentry/utils/useApi';
import useCleanQueryParamsOnRouteLeave from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = {
  group: Group;
};

function GroupReplays({group}: Props) {
  const api = useApi();
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  const [response, setResponse] = useState<{
    pageLinks: null | string;
    replayIds: undefined | string[];
  }>({pageLinks: null, replayIds: undefined});

  const {cursor} = location.query;
  const fetchReplayIds = useCallback(async () => {
    const eventView = EventView.fromSavedQuery({
      id: '',
      name: `Errors within replay`,
      version: 2,
      fields: ['replayId', 'count()'],
      query: `issue.id:${group.id} !replayId:""`,
      projects: [],
    });

    try {
      const [{data}, _textStatus, resp] = await doDiscoverQuery<TableData>(
        api,
        `/organizations/${organization.slug}/events/`,
        eventView.getEventsAPIPayload({
          query: {cursor},
        } as Location<ReplayListLocationQuery>)
      );

      setResponse({
        pageLinks: resp?.getResponseHeader('Link') ?? '',
        replayIds: data.map(record => String(record.replayId)),
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  }, [api, cursor, organization.slug, group.id]);

  const eventView = useMemo(() => {
    if (!response.replayIds) {
      return null;
    }
    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: REPLAY_LIST_FIELDS,
      projects: [Number(group.project.id)],
      query: `id:[${String(response.replayIds)}]`,
      orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
    });
  }, [location.query.sort, group.project.id, response.replayIds]);

  useCleanQueryParamsOnRouteLeave({fieldsToClean: ['cursor']});
  useEffect(() => {
    fetchReplayIds();
  }, [fetchReplayIds]);

  if (!eventView) {
    return null;
  }
  return (
    <GroupReplaysTable
      eventView={eventView}
      organization={organization}
      pageLinks={response.pageLinks}
    />
  );
}

const GroupReplaysTable = ({
  eventView,
  organization,
  pageLinks,
}: {
  eventView: EventView;
  organization: Organization;
  pageLinks: string | null;
}) => {
  const location = useMemo(() => ({query: {}} as Location<ReplayListLocationQuery>), []);

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
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
