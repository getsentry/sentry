import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getQueryParamAsString} from 'sentry/utils/replays/getQueryParamAsString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import ReplayTable from 'sentry/views/replays/replayTable';
import {Replay} from 'sentry/views/replays/types';

const DEFAULT_DISCOVER_LIMIT = 50;

const GroupReplays = () => {
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams();

  const getEventView = () => {
    const {groupId} = params;
    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: [
        'eventID',
        'project',
        'timestamp',
        'url',
        'user.display',
        'user.email',
        'user.id',
        'user.ip_address',
        'user.name',
        'user.username',
      ],
      projects: [],
      orderby: getQueryParamAsString(query.sort) || '-timestamp',
      query: `issue.id:${groupId}`,
    };

    return EventView.fromNewQueryWithLocation(eventQueryParams, location);
  };

  const {query} = location;
  const {cursor: _cursor, page: _page, ...currentQuery} = query;

  const sort: {
    field: string;
  } = {
    field: getQueryParamAsString(query.sort) || '-timestamp',
  };

  const arrowDirection = sort.field.startsWith('-') ? 'down' : 'up';
  const sortArrow = <IconArrow color="gray300" size="xs" direction={arrowDirection} />;

  return (
    <Fragment>
      <StyledPageHeader>
        <HeaderTitle>
          {t('Replays')} <FeatureBadge type="alpha" />
        </HeaderTitle>
      </StyledPageHeader>
      <StyledPageContent>
        <DiscoverQuery
          eventView={getEventView()}
          location={location}
          orgSlug={organization.slug}
          limit={DEFAULT_DISCOVER_LIMIT}
        >
          {data => {
            return (
              <Fragment>
                <StyledPanelTable
                  isLoading={data.isLoading}
                  isEmpty={data.tableData?.data.length === 0}
                  headers={[
                    t('Session'),
                    <SortLink
                      key="timestamp"
                      role="columnheader"
                      aria-sort={
                        !sort.field.endsWith('timestamp')
                          ? 'none'
                          : sort.field === '-timestamp'
                          ? 'descending'
                          : 'ascending'
                      }
                      to={{
                        pathname: location.pathname,
                        query: {
                          ...currentQuery,
                          sort: sort.field === '-timestamp' ? 'timestamp' : '-timestamp',
                        },
                      }}
                    >
                      {t('Timestamp')} {sort.field.endsWith('timestamp') && sortArrow}
                    </SortLink>,
                    t('Duration'),
                    t('Errors'),
                  ]}
                >
                  {data.tableData ? (
                    <ReplayTable replayList={data.tableData.data as Replay[]} />
                  ) : null}
                </StyledPanelTable>
                <Pagination pageLinks={data.pageLinks} />
              </Fragment>
            );
          }}
        </DiscoverQuery>
      </StyledPageContent>
    </Fragment>
  );
};

const StyledPageHeader = styled(PageHeader)`
  background-color: ${p => p.theme.background};
  min-width: max-content;
  padding: ${space(3)} ${space(0)} ${space(4)} ${space(4)};
  margin-bottom: ${space(0)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(0, 1fr) max-content max-content max-content;
`;

const HeaderTitle = styled(PageHeading)`
  display: flex;
  align-items: center;
  flex: 1;
`;

const StyledPageContent = styled(PageContent)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

const SortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }

  svg {
    vertical-align: top;
  }
`;

export default GroupReplays;
