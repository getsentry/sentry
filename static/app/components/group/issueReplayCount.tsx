import {useContext} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import ReplayCountContext from 'sentry/components/replays/replayCountContext';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  groupId: string;
};

/**
 * Show the count of how many replays are associated to an issue.
 */
function IssueReplayCount({groupId}: Props) {
  const organization = useOrganization();
  const count = useContext(ReplayCountContext)[groupId];

  if (count === undefined || count === 0) {
    return null;
  }

  const countDisplay = count > 50 ? '50+' : count;
  const titleOver50 = t('This issue has 50+ replay available to view');
  const title50OrLess = tn(
    'This issue has %s replay available to view',
    'This issue has %s replays available to view',
    count
  );
  return (
    <Tooltip skipWrapper title={count > 50 ? titleOver50 : title50OrLess}>
      <ReplayCountLink
        to={`/organizations/${organization.slug}/issues/${groupId}/replays/`}
        aria-label="replay-count"
      >
        <IconPlay size="xs" />
        {countDisplay}
      </ReplayCountLink>
    </Tooltip>
  );
}

const ReplayCountLink = styled(Link)`
  display: inline-flex;
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeSmall};
  gap: 0 ${space(0.5)};
`;

export default IssueReplayCount;
