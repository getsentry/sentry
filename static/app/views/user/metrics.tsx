import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {IconFire, IconPlay, IconSpan} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
// import useProjects from "sentry/utils/useProjects";

interface Props {
  userId: string;
}

export function Metrics({userId}: Props) {
  const {
    isLoading: isErrorLoading,
    data: errorData,
    error: errorError,
  } = useFetchErrorCount({userId});
  const {
    isLoading: isTransactionLoading,
    data: transactionData,
    error: transactionError,
  } = useFetchTransactionCount({userId});

  if (isErrorLoading || isTransactionLoading) {
    return <Placeholder height="20px" />;
  }

  if (errorError || transactionError) {
    return null;
  }

  return (
    <Fragment>
      <RedBox>
        <RedFire size="md" />
        {errorData?.data?.length ? errorData.data[0]['count()'] : 0}
      </RedBox>
      <Box>
        <IconSpan size="md" />
        {formatAbbreviatedNumber(
          transactionData?.data?.length ? transactionData.data[0]['count()'] : 0
        )}
      </Box>
      <Box>
        <IconPlay size="md" />0
      </Box>
    </Fragment>
  );
}

const RedFire = styled(IconFire)`
  color: ${p => p.theme.error};
`;

const Box = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const RedBox = styled(Box)`
  color: ${p => p.theme.error};
  font-weight: bold;
`;

function useFetchErrorCount({userId}: {userId: string}) {
  const location = useLocation();
  const organization = useOrganization();
  // const {projects} = useProjects();
  // const projectsHash = Object.fromEntries(projects.map(project => [project.id, project]));

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('event.type', 'error');
    conditions.addFilterValue('user.id', userId);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['count()'],
        projects: [],
        query: conditions.formatString(),
        range: '90d',
        // orderby: '-issue.id',
      },
      location
    );
  }, [location, userId]);

  return useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 3,
  });
}

function useFetchTransactionCount({userId}: {userId: string}) {
  const location = useLocation();
  const organization = useOrganization();
  // const {projects} = useProjects();
  // const projectsHash = Object.fromEntries(projects.map(project => [project.id, project]));

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('event.type', 'transaction');
    conditions.addFilterValue('user.id', userId);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: ['count()'],
        projects: [],
        query: conditions.formatString(),
        range: '90d',
        // orderby: '-issue.id',
      },
      location
    );
  }, [location, userId]);

  return useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 3,
  });
}
