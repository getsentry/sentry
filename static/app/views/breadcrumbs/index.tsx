import {useEffect, useMemo, useState} from 'react';
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

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['session_id', 'count_unique(session_id)'],
        projects: [],
        query: conditions.formatString(),
      },
      location
    );
  }, [location]);

  useEffect(() => {
    api.clear();

    async function fetchEvents() {
      const res = await api.requestPromise(`/organizations/${org.slug}/events/`, {
        query: {
          ...eventView.getEventsAPIPayload(location),
        },
        method: 'GET',
      });

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
        <PanelTable
          isLoading={isLoading}
          isEmpty={sessions.length === 0}
          headers={[t('Session')]}
        >
          {sessions.map(session => (
            <Item key={session.session_id}>
              <Link to={`/organizations/${org.slug}/breadcrumbs/${session.session_id}`}>
                {session.session_id}
              </Link>
            </Item>
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
