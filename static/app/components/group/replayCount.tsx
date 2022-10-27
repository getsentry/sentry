import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
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
      {({isLoading, tableData}) => {
        if (isLoading) {
          return <Placeholder width="24px" height="14px" />;
        }

        const replayCount = tableData?.data?.length ?? 0;
        if (replayCount > 0) {
          return (
            <Tooltip
              title={t('This issue has %s replays available to view', replayCount)}
            >
              <ReplayCountLink
                to={`/organizations/${orgId}/issues/${groupId}/replays/`}
                data-test-id="replay-count"
              >
                <IconPlay size="xs" />
                {replayCount}
              </ReplayCountLink>
            </Tooltip>
          );
        }

        return null;
      }}
    </DiscoverQuery>
  );
}

const ReplayCountLink = styled(Link)`
  display: inline-flex;
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeSmall};
  gap: 0 ${space(0.5)};
`;

export default ReplayCount;
