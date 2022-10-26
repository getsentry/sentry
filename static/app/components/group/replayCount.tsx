import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {IconPlay} from 'sentry/icons';
import DiscoverQuery, {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';

type Props = {
  groupId: string;
  orgId: string;
};

function ReplayCount({orgId, groupId}: Props) {
  const location = useLocation();

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: '',
      name: `Errors within replay`,
      version: 2,
      fields: ['replayId', 'count()'],
      query: `issue.id:${groupId} !replayId:""`,
      projects: [],
    },
    location
  );

  return (
    <DiscoverQuery eventView={eventView} orgSlug={orgId} location={location} useEvents>
      {({isLoading, tableData}) =>
        isLoading ? (
          <Placeholder width="36px" height="14px" />
        ) : (
          <ReplayCountContainer>
            <IconPlay size="xs" />
            {getReplayCount(tableData)}
          </ReplayCountContainer>
        )
      }
    </DiscoverQuery>
  );
}

function getReplayCount(tableData: TableData | null) {
  return tableData?.data.reduce(
    (acc, item) => (typeof item['count()'] === 'number' ? item['count()'] + acc : acc),
    0
  );
}

const ReplayCountContainer = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  gap: 0 2px;
`;

export default ReplayCount;
