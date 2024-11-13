import {useNavContext} from 'sentry/components/nav/context';

import ExploreSubmenu from './explore';
import InsightsSubmenu from './insights';
import IssuesSubmenu from './issues';
import PerformanceSubmenu from './performance';

export default function ActiveSubmenu() {
  const {activeMenuId} = useNavContext();

  switch (activeMenuId) {
    case 'explore':
      return <ExploreSubmenu />;
    case 'insights':
      return <InsightsSubmenu />;
    case 'issues':
      return <IssuesSubmenu />;
    case 'performance':
      return <PerformanceSubmenu />;
    default:
      return null;
  }
}
