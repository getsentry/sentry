import {Fragment, useEffect, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageHeading from 'sentry/components/pageHeading';
import {PanelTable} from 'sentry/components/panels';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {FIELD_FORMATTERS} from 'sentry/utils/discover/fieldRenderers';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import Breadcrumb from './breadcrumb';

type BreadcrumbEvent = {
  id: string;
  timestamp: string;
  title: string | undefined;
  'transaction.op': string | undefined;
  'transaction.status': string | undefined;
  'user.display': string | undefined;
};

interface Props extends RouteComponentProps<{sessionId: string}, {}, any, {t: number}> {}

function SessionView({params: {sessionId}}: Props) {
  const org = useOrganization();
  const api = useApi();
  const location = useLocation();
  const [isLoading, setLoading] = useState(false);
  const [breadcrumbEvents, setBreadcrumbEvents] = useState<Array<BreadcrumbEvent>>([]);

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    conditions.addStringFilter('has:sid');
    conditions.addStringFilter(`sid:${sessionId}`);
    // conditions.addStringFilter(`title:"Breadcrumb Event"`);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'id',
          'timestamp',
          'title',
          'transaction.op',
          'transaction.status',
          'user.display',
        ],
        projects: [],
        orderby: '-timestamp',
        // TODO: Filter based on incoming sid and Breadcrumb Event title
        query: conditions.formatString(),
      },
      location
    );
  }, [location, sessionId]);

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
      // eslint-disable-next-line no-console
      console.log(res);
      setBreadcrumbEvents(res.data);
      setLoading(false);
    }
    fetchEvents();
  }, [api, org, location, eventView]);

  const timestampTitle = (
    <div style={{display: 'flex'}}>
      <span>{t('Timestamp')}</span>
      <IconArrow direction="down" size="xs" />
    </div>
  );

  return (
    <StyledPageContent>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={org}
            eventView={eventView}
            location={location}
            sessionId={sessionId}
          />
          <PageHeading>{t(`Session: ${sessionId}`)}</PageHeading>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <PanelTable
            isLoading={isLoading}
            isEmpty={breadcrumbEvents.length === 0}
            headers={[
              t('Event Id'),
              t('Title'),
              t('Txn Operation'),
              t('Txn Status'),
              t('user'),
              timestampTitle,
            ]}
          >
            {breadcrumbEvents.map(event => (
              <Fragment key={event.id}>
                <Item>{event.id}</Item>
                <Item>{event.title}</Item>
                <Item>{event['transaction.op']}</Item>
                <Item>{event['transaction.status']}</Item>
                <Item>{event['user.display']}</Item>
                <Item>
                  {FIELD_FORMATTERS.date.renderFunc('timestamp', {
                    ['timestamp']: event.timestamp,
                  })}
                </Item>
              </Fragment>
            ))}
          </PanelTable>
        </Layout.Main>
      </Layout.Body>
    </StyledPageContent>
  );
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

// TODO: keep?
const _Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const Item = styled('div')`
  display: flex;
  align-items: center;
`;

export default SessionView;
