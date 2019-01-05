import affectedUsers from '../widgets/affectedUsers';
import errorsByGeo from '../widgets/errorsByGeo';
import eventsByReleasePercent from '../widgets/eventsByReleasePercent';
import eventsByReleaseArea from '../widgets/eventsByReleaseArea';
import events from '../widgets/events';
import handledVsUnhandled from '../widgets/handledVsUnhandled';
import topBrowsers from '../widgets/topBrowsers';
import topDevices from '../widgets/topDevices';

const overviewDashboard = {
  widgets: [
    events,
    handledVsUnhandled,
    affectedUsers,
    topBrowsers,
    topDevices,
    eventsByReleasePercent,
    eventsByReleaseArea,
    errorsByGeo,
  ],
};

export default overviewDashboard;
