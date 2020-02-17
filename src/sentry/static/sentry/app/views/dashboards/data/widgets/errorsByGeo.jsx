import {WIDGET_DISPLAY} from 'app/views/dashboards/constants';

import errorsByGeoQuery from '../queries/errorsByGeo';

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
