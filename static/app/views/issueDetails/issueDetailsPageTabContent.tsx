import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

import {GroupEventDetails} from './groupEventDetails/groupEventDetails';
import type {IssueDetailsPageTab} from './issueDetailsQueryParams';
import {Tab} from './types';

const PAGE_TAB_CONTENT: Record<IssueDetailsPageTab, React.ComponentType> = {
  // Details is the default tab, so it isn't lazy loaded
  [Tab.DETAILS]: GroupEventDetails,
  [Tab.EVENTS]: make(() => import('sentry/views/issueDetails/groupEvents')),
  [Tab.REPLAYS]: make(() => import('sentry/views/issueDetails/groupReplays')),
  [Tab.OPEN_PERIODS]: make(() => import('sentry/views/issueDetails/groupOpenPeriods')),
  [Tab.UPTIME_CHECKS]: make(() => import('sentry/views/issueDetails/groupUptimeChecks')),
  [Tab.CHECK_INS]: make(() => import('sentry/views/issueDetails/groupCheckIns')),
  [Tab.AUTOFIX]: make(() => import('sentry/views/issueDetails/autofix')),
  [Tab.USER_FEEDBACK]: make(() => import('sentry/views/issueDetails/groupUserFeedback')),
  [Tab.ATTACHMENTS]: make(
    () => import('sentry/views/issueDetails/groupEventAttachments')
  ),
};

/**
 * The content of a page tab. Tabs other than details load on demand.
 */
export function IssueDetailsPageTabContent({tab}: {tab: IssueDetailsPageTab}) {
  const Content = PAGE_TAB_CONTENT[tab];
  return <Content />;
}
