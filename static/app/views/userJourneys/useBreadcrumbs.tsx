import {useEffect, useMemo, useState} from 'react';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {RawCrumb} from 'sentry/types/breadcrumbs';
import {EntryBreadcrumbs, EntryType, Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  userId: string;
};

interface BreadcrumbEvent {
  id: string;
  project: string;
  timestamp: string;
  title: string | undefined;
  'transaction.op': string | undefined;
  'transaction.status': string | undefined;
  'user.display': string | undefined;
}

function useBreadcrumbs(props: Props) {
  const {userId} = props;
  const org = useOrganization();
  const api = useApi();
  const location = useLocation();
  const [isLoading, setLoading] = useState(false);
  const [breadcrumbEvents, setBreadcrumbEvents] = useState<Array<BreadcrumbEvent>>([]);
  const [sampleEvent, setSampleEvent] = useState<Event>();
  const [crumbs, setCrumbs] = useState<RawCrumb[]>([]);

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    conditions.addStringFilter('has:did');
    conditions.addStringFilter(`did:${userId}`);
    // conditions.addStringFilter(`title:"Breadcrumb Event"`);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['id', 'timestamp', 'title', 'user.display', 'project'],
        projects: [-1],
        orderby: '-timestamp',
        query: conditions.formatString(),
      },
      location
    );
  }, [location, userId]);

  useEffect(() => {
    api.clear();
    setLoading(true);

    async function fetchEvents() {
      const res = await api.requestPromise(`/organizations/${org.slug}/events/`, {
        query: {
          ...eventView.getEventsAPIPayload(location),
        },
        method: 'GET',
      });

      setBreadcrumbEvents(res.data);
    }
    fetchEvents();
  }, [api, org.slug, location, eventView]);

  useEffect(() => {
    if (breadcrumbEvents.length === 0) {
      return;
    }
    async function fetchEvent() {
      const res = await Promise.all(
        breadcrumbEvents
          .filter(e => e.title === 'Breadcrumb Event')
          .map(async e => {
            return await api.requestPromise(
              `/projects/${org.slug}/${e.project}/events/${e.id}/`
            );
          })
      );

      const events = res as Event[];
      // eslint-disable-next-line no-console
      console.log(events);
      if (events) {
        setSampleEvent(events[0]);
        const breadcrumbs: RawCrumb[] = events.reduce((acc, event) => {
          const breadcrumbEntries = event.entries.filter(
            entry => entry.type === EntryType.BREADCRUMBS
          ) as EntryBreadcrumbs[];
          const rawCrumbVals = breadcrumbEntries.flatMap(entry => entry.data.values);
          return [...acc, ...rawCrumbVals];
        }, [] as RawCrumb[]);
        setCrumbs(breadcrumbs);
        // eslint-disable-next-line no-console
        console.log(breadcrumbs);
      }
      setLoading(false);
    }
    fetchEvent();
  }, [api, breadcrumbEvents, org.slug]);

  // const timestampTitle = (
  //   <div style={{display: 'flex'}}>
  //     <span>{t('Timestamp')}</span>
  //     <IconArrow direction="down" size="xs" />
  //   </div>
  // );

  const transformedCrumbs = transformCrumbs(crumbs);
  const relativeTime = transformedCrumbs[transformedCrumbs.length - 1]?.timestamp;

  return {
    isLoading,
    eventView,
    transformedCrumbs,
    sampleEvent,
    relativeTime,
    crumbs,
  };
}

export default useBreadcrumbs;
