import {useEffect, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Clipboard from 'sentry/components/clipboard';
import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageHeading from 'sentry/components/pageHeading';
import {IconCopy} from 'sentry/icons';
// import {PanelTable} from 'sentry/components/panels';
// import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {RawCrumb} from 'sentry/types/breadcrumbs';
import {EntryBreadcrumbs, EntryType, Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
// import {FIELD_FORMATTERS} from 'sentry/utils/discover/fieldRenderers';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

// import useProjects from 'sentry/utils/useProjects';
import Breadcrumb from './breadcrumb';
import Content from './content';

interface BreadcrumbEvent {
  id: string;
  project: string;
  timestamp: string;
  title: string | undefined;
  'transaction.op': string | undefined;
  'transaction.status': string | undefined;
  'user.display': string | undefined;
}

interface Props extends RouteComponentProps<{userId: string}, {}, any, {t: number}> {}

function UserView({params: {userId}, router, route}: Props) {
  const org = useOrganization();
  // const {projects} = useProjects();
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

      // setBreadcrumbEvents(res.data);

      // TODO: alberto debug
      if (res.data && res.data.length > 0) {
        setBreadcrumbEvents([res.data[0]]);
      } else {
        setBreadcrumbEvents(res.data);
      }
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

  return (
    <StyledPageContent>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={org}
            eventView={eventView}
            location={location}
            userId={userId}
          />
          <PageHeading>{t('User Journey Details')}</PageHeading>
          <UserIdWrapper>
            {userId}
            <Clipboard value={userId}>
              <ClipboardIconWrapper>
                <IconCopy size="xs" />
              </ClipboardIconWrapper>
            </Clipboard>
          </UserIdWrapper>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          {isLoading && <LoadingIndicator />}
          {!isLoading && crumbs.length > 0 && sampleEvent && (
            <Content
              breadcrumbs={transformCrumbs(crumbs)}
              displayRelativeTime={false}
              onSwitchTimeFormat={() => {}}
              organization={org}
              searchTerm=""
              event={sampleEvent}
              relativeTime={relativeTime || ''}
              emptyMessage={
                (<div>{t('There are no breadcrumbs to display')}</div>) as any
              }
              route={route}
              router={router}
            />
          )}
          {/* <PanelTable
            isLoading={isLoading}
            isEmpty={crumbs.length === 0}
            headers={[
              t('Category'),
              t('Type'),
              t('Level'),
              t('Data'),
              t('Message'),
              timestampTitle,
            ]}
          >
            {crumbs.map(crumb => (
              <Fragment key={crumb.timestamp}>
                <Item>{crumb.category}</Item>
                <Item>{crumb.type}</Item>
                <Item>{crumb.level}</Item>
                <Item>{JSON.stringify(crumb.data)}</Item>
                <Item>{crumb.message}</Item>
                <Item>
                  {FIELD_FORMATTERS.date.renderFunc('timestamp', {
                    ['timestamp']: crumb.timestamp,
                  })}
                </Item>
              </Fragment>
            ))}
          </PanelTable> */}
        </Layout.Main>
      </Layout.Body>
    </StyledPageContent>
  );
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const ClipboardIconWrapper = styled('span')`
  &:hover {
    cursor: pointer;
  }
  margin-left: 5px;
  display: flex;
  align-items: center;
`;

const UserIdWrapper = styled('span')`
  color: ${p => p.theme.gray300};
  display: flex;
`;

// TODO: keep?
// const _Header = styled('div')`
//   display: flex;
//   align-items: center;
//   justify-content: space-between;
//   margin-bottom: ${space(2)};
// `;

// const Item = styled('div')`
//   display: flex;
//   align-items: center;
// `;

export default UserView;
