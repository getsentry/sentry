import affectedUsers from '../widgets/affectedUsers';
import errorsByGeo from '../widgets/errorsByGeo';
import eventsByReleasePercent from '../widgets/eventsByReleasePercent';
import events from '../widgets/events';
import handledVsUnhandled from '../widgets/handledVsUnhandled';
import topDevicesAndBrowsers from '../widgets/topDevicesAndBrowsers';

const overviewDashboard = {
  widgets: [
    events,
    eventsByReleasePercent,
    affectedUsers,
    errorsByGeo,
    handledVsUnhandled,
    topDevicesAndBrowsers,
  ],
};

export default overviewDashboard;
