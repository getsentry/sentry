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

interface User {
  'count(did)': number;
  did: string;
  'last_seen()': string;
}

function Breadcrumbs({}: Props) {
  const org = useOrganization();
  const api = useApi();
  const location = useLocation();
  const [users, setUsers] = useState<Array<User>>([]);
  const [isLoading, setLoading] = useState(false);

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    conditions.addStringFilter('has:did');

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['did', 'count(did)', 'last_seen()'],
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

      setUsers(res.data.filter(user => user.did !== ''));
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
          <PageHeading>{t('User Journeys')}</PageHeading>
        </Header>
        <PageFilterBar>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="right" />
        </PageFilterBar>
        <br />
        <PanelTable
          isLoading={isLoading}
          isEmpty={users.length === 0}
          headers={[t('User'), t('Number of Events'), lastActivity]}
        >
          {users.map(user => (
            <Fragment key={user.did}>
              <Item>
                <Link to={`/organizations/${org.slug}/user-journeys/${user.did}`}>
                  {user.did}
                </Link>
              </Item>
              <Item>{user['count(did)']}</Item>
              <Item>
                {FIELD_FORMATTERS.date.renderFunc('last_seen()', {
                  ['last_seen()']: user['last_seen()'],
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
