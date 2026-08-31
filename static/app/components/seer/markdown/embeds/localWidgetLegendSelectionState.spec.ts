import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';
import {WidgetLegendNameEncoderDecoder} from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import {LocalWidgetLegendSelectionState} from './localWidgetLegendSelectionState';

describe('LocalWidgetLegendSelectionState', () => {
  it('stores legend selection without changing URL query state', () => {
    const widget = WidgetFixture({id: '123', displayType: DisplayType.BAR});
    const legendState = new LocalWidgetLegendSelectionState({
      dashboard: DashboardFixture([widget]),
      organization: OrganizationFixture(),
    });
    const selection = {
      [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend('count()', widget.id)]:
        false,
    };

    legendState.setWidgetSelectionState(selection, widget);

    expect(legendState.getWidgetSelectionState(widget)).toEqual(selection);
    expect(legendState.location.query).toEqual({});
  });
});
