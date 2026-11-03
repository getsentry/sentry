import {deserializeLinkedDashboards} from 'sentry/views/dashboards/widgetBuilder/utils/linkedDashboards';
import {serializeLinkedDashboards} from 'sentry/views/dashboards/widgetBuilder/utils/serialization';

describe('deserializeLinkedDashboards', () => {
  it('returns an empty list when there are no values', () => {
    expect(deserializeLinkedDashboards([])).toEqual([]);
  });

  it('round trips linked dashboards through serializeLinkedDashboards', () => {
    const linkedDashboards = [
      {dashboardId: '1', field: 'transaction'},
      {dashboardId: '-1', field: 'project'},
    ];

    const result = deserializeLinkedDashboards(
      serializeLinkedDashboards(linkedDashboards)
    );

    expect(result).toEqual(linkedDashboards);
  });

  it('reads a numeric dashboardId as a string when the URL came from a saved widget', () => {
    const result = deserializeLinkedDashboards(['{"dashboardId":5,"field":"project"}']);

    expect(result).toEqual([{dashboardId: '5', field: 'project'}]);
  });

  it('drops extra keys when an entry has them', () => {
    const result = deserializeLinkedDashboards([
      JSON.stringify({
        additionalGlobalFilterDatasetTargets: ['spans'],
        dashboardId: '1',
        extra: true,
        field: 'transaction',
        staticDashboardId: 2,
      }),
    ]);

    expect(result).toEqual([{dashboardId: '1', field: 'transaction'}]);
  });

  it('drops only the malformed entries when valid ones are mixed in', () => {
    const result = deserializeLinkedDashboards([
      '{"dashboardId":"1","field":"a"}',
      'not json',
      '{"dashboardId":',
      'null',
      '[]',
      '"1"',
      '{"field":"b"}',
      '{"dashboardId":"2"}',
      '{"dashboardId":"","field":"c"}',
      '{"dashboardId":0,"field":"d"}',
      '{"dashboardId":"3","field":""}',
      '{"dashboardId":true,"field":"e"}',
      '{"dashboardId":["4"],"field":"f"}',
      '{"dashboardId":"5","field":5}',
      '{"dashboardId":"0","field":"g"}',
    ]);

    expect(result).toEqual([
      {dashboardId: '1', field: 'a'},
      {dashboardId: '0', field: 'g'},
    ]);
  });
});
