import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';
import errorsByGeoQuery from 'app/views/organizationDashboard/data/queries/errorsByGeo';

const errorsByGeo = {
  type: WIDGET_DISPLAY.WORLD_MAP,
  title: 'Errors by Country',
  queries: {discover: [errorsByGeoQuery]},
  compareToPeriod: {
    statsPeriodStart: '15d',
    statsPeriodEnd: '8d',
  },
};

export default errorsByGeo;
