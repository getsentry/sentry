/**
 * This module is used as a webpack chunk to consolidate our
 * echarts imports into a single chunk so that each view with charts
 * doesn't have echarts bundled into it.
 *
 * Add new echarts components below as we need to use them.
 *
 * Only the react component library is exported as we don't generally want
 * to use any other APIs from echarts.
 */

import 'zrender/lib/svg/svg';
import echarts from 'echarts/lib/echarts';
import 'echarts/lib/component/dataZoom';
import 'echarts/lib/component/graphic';
import 'echarts/lib/component/legend';
import 'echarts/lib/component/legendScroll';
import 'echarts/lib/component/markLine';
import 'echarts/lib/component/markPoint';
import 'echarts/lib/component/toolbox';
import 'echarts/lib/component/tooltip';
import 'echarts/lib/component/visualMap';
import 'echarts/lib/chart/bar';
import 'echarts/lib/chart/line';
import 'echarts/lib/chart/pie';
import ReactEchartsCore from 'echarts-for-react/lib/core';

export {ReactEchartsCore, echarts};
