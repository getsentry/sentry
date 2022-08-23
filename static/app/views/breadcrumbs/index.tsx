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

interface Props {}

interface Session {
  'count(sid)': number;
  'last_seen()': string;
  sid: string;
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

    conditions.addStringFilter('has:sid');

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['sid', 'count(sid)', 'last_seen()'],
        projects: [],
        orderby: '-last_seen',
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

      setSessions(res.data.filter(session => session.sid !== ''));
      setLoading(false);
    }
    fetchEvents();
  }, [api, org, location, eventView]);

  const lastActivity = (
    <div style={{display: 'flex'}}>
      <span>{t('Last Activity')}</span>
      <IconArrow direction="down" size="xs" />
    </div>
  );

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
          headers={[t('Session'), t('Number of Events'), lastActivity]}
        >
          {sessions.map(session => (
            <Fragment key={session.sid}>
              <Item>
                <Link to={`/organizations/${org.slug}/breadcrumbs/${session.sid}`}>
                  {session.sid}
                </Link>
              </Item>
              <Item>{session['count(sid)']}</Item>
              <Item>
                {FIELD_FORMATTERS.date.renderFunc('last_seen()', {
                  ['last_seen()']: session['last_seen()'],
                })}
              </Item>
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
