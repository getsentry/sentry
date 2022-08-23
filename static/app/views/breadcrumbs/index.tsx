import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import Link from 'sentry/components/links/link';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import {PanelTable} from 'sentry/components/panels';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {}

interface Session {
  'count(session_id)': number;
  'last_seen()': string;
  session_id: string;
}

function Breadcrumbs({}: Props) {
  const org = useOrganization();
  const api = useApi();
  const location = useLocation();
  const [sessions, setSessions] = useState<Array<Session>>([]);
  const [isLoading, setLoading] = useState(false);

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    conditions.addStringFilter('has:session_id');

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['session_id', 'count(session_id)', 'last_seen()'],
        projects: [],
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

      console.log('res.data', res.data);
      setSessions(res.data.filter(session => session.session_id !== ''));
      setLoading(false);
    }
    fetchEvents();
  }, [api, org, location, eventView]);

  return (
    <PageFiltersContainer>
      <PageContent>
        <Header>
          <PageHeading>{t('Breadcrumbs')}</PageHeading>
        </Header>
        <PageFilterBar>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="right" />
        </PageFilterBar>
        <br />
        <PanelTable
          isLoading={isLoading}
          isEmpty={sessions.length === 0}
          headers={[t('Session'), t('Last Activity'), t('Number of Events')]}
        >
          {sessions.map(session => (
            <Fragment key={session.session_id}>
              <Item>
                <Link to={`/organizations/${org.slug}/breadcrumbs/${session.session_id}`}>
                  {session.session_id}
                </Link>
              </Item>
              <Item>{session['last_seen()']}</Item>
              <Item>{session['count(session_id)']}</Item>
            </Fragment>
          ))}
        </PanelTable>
      </PageContent>
    </PageFiltersContainer>
  );
}

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const Item = styled('div')`
  display: flex;
  align-items: center;
`;

export default Breadcrumbs;
