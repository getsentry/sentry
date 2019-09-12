import {WIDGET_DISPLAY} from 'app/views/dashboards/constants';

import handledVsUnhandledQuery from '../queries/handledVsUnhandled';

const handledVsUnhandled = {
  type: WIDGET_DISPLAY.LINE_CHART,
  queries: {discover: [handledVsUnhandledQuery]},

  title: 'Handled vs. Unhandled',
  fieldLabelMap: {
    '0': 'Unhandled',
    '1': 'Handled',
    null: 'Unknown',
  },
};

export default handledVsUnhandled;
