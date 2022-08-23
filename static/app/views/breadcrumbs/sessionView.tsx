import {useEffect, useMemo} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageHeading from 'sentry/components/pageHeading';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import Breadcrumb from './breadcrumb';

interface Props extends RouteComponentProps<{sessionId: string}, {}, any, {t: number}> {}

function SessionView({params: {sessionId}}: Props) {
  const org = useOrganization();
  const api = useApi();
  const location = useLocation();
  const [isLoading, setLoading] = useState(false);

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    conditions.addStringFilter('has:session_id');
    conditions.addStringFilter(`session_id:${sessionId}`);
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
          'user.email',
        ],
        projects: [],
        // TODO: Filter based on incoming session_id and Breadcrumb Event title
        query: conditions.formatString(),
      },
      location
    );
  }, [location]);

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
      setLoading(false);
    }
    fetchEvents();
  }, [api, org, location, eventView]);

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
        <Layout.Main fullWidth>Session View here</Layout.Main>
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

export default SessionView;
