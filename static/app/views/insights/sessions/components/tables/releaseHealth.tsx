import {Fragment} from 'react';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import ReleaseHealthTable from 'sentry/views/insights/sessions/components/tables/releaseHealthTable';
import useOrganizationReleases from 'sentry/views/insights/sessions/queries/useOrganizationReleases';

export default function ReleaseHealth() {
  const {releaseData, isLoading, isError, pageLinks} = useOrganizationReleases();

  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Fragment>
      <ReleaseHealthTable
        data={releaseData}
        isError={isError}
        isLoading={isLoading}
        location={location}
        meta={{
          fields: {
            release: 'string',
            date: 'date',
            stage: 'string',
            crash_free_sessions: 'percentage',
            sessions: 'integer',
            error_count: 'integer',
          },
          units: {
            crash_free_sessions: '%',
          },
        }}
      />
      <PaginationNoMargin
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          navigate({
            pathname: path,
            query: {...searchQuery, cursor},
          });
        }}
      />
    </Fragment>
  );
}

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
