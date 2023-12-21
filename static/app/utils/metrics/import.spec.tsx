import {parseDashboard} from 'sentry/utils/metrics/import';

import {cronMetrics, ddmMetrics, dynamicSampling} from './temp-data';

describe('parseWidget', () => {
  // it.each(data.widgets[0].definition.widgets)('should parse widget', widget => {
  //   // @ts-expect-error
  //   // const widget = data.widgets[0].definition.widgets[0];
  //   // @ts-expect-error
  //   const result = new WidgetParser(widget).parse(widget);

  //   console.log(JSON.stringify(result.widgets, null, 2));
  // });

  it('should parse dashboard', async () => {
    // @ts-expect-error
    const result = await parseDashboard(cronMetrics);
    console.log('Parsed dashboard', cronMetrics.title);
    console.table(result.reports, ['id', 'outcome', 'errors', 'notes']);
  });

  it('should parse dashboard', async () => {
    // @ts-expect-error
    const result = await parseDashboard(ddmMetrics);
    console.log('Parsed dashboard', ddmMetrics.title);
    console.table(result.reports, ['id', 'outcome', 'errors', 'notes']);
  });

  it('should parse dashboard', async () => {
    // @ts-expect-error
    const result = await parseDashboard(dynamicSampling);
    console.log('Parsed dashboard', dynamicSampling.title);
    console.table(result.reports, ['id', 'outcome', 'errors', 'notes']);
  });

  // it('should parse widget', () => {
  //   // @ts-expect-error
  //   const widget = ddmMetrics.widgets[0].definition.widgets[8];
  //   // @ts-expect-error
  //   const result = new WidgetParser(widget).parse();

  //   console.log(JSON.stringify(result, null, 2));
  // });
});
