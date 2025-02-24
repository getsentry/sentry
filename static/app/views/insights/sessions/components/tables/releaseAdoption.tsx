import {Fragment} from 'react';
import styled from '@emotion/styled';

import Pagination from 'sentry/components/pagination';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import ReleaseAdoptionTable from 'sentry/views/insights/sessions/components/tables/releaseAdoptionTable';
import useOrganizationReleases from 'sentry/views/insights/sessions/queries/useOrganizationReleases';

export default function ReleaseAdoption({filters}: {filters: string[]}) {
  const {releaseData, isLoading, isError, pageLinks} = useOrganizationReleases({
    tableType: 'adoption',
    filters,
  });

  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Fragment>
      <ReleaseAdoptionTable
        data={releaseData}
        isError={isError}
        isLoading={isLoading}
        location={location}
        meta={{
          fields: {
            release: 'string',
            date: 'date',
            stage: 'string',
            lifespan: 'duration',
            adoption: 'percentage',
          },
          units: {
            adoption: '%',
            lifespan: 'millisecond',
          },
        }}
      />
      <PaginationNoMargin
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          navigate({
            pathname: path,
            query: {...searchQuery, cursor_adoption_table: cursor},
          });
        }}
      />
    </Fragment>
  );
}

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
