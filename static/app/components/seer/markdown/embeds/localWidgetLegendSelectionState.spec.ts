import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';
import {WidgetLegendNameEncoderDecoder} from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';

import {useLocalWidgetLegendSelectionState} from './localWidgetLegendSelectionState';

describe('LocalWidgetLegendSelectionState', () => {
  it('stores legend selection locally and rerenders the consumer', () => {
    const widget = WidgetFixture({id: '123', displayType: DisplayType.BAR});
    const dashboard = DashboardFixture([widget]);
    const organization = OrganizationFixture();
    const renderSpy = jest.fn();
    const {result} = renderHook(() => {
      renderSpy();
      return useLocalWidgetLegendSelectionState({
        dashboard,
        organization,
      });
    });
    const legendState = result.current;
    const selection = {
      [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend('count()', widget.id)]:
        false,
    };
    const initialRenderCount = renderSpy.mock.calls.length;

    act(() => legendState.setWidgetSelectionState(selection, widget));

    expect(result.current).toBe(legendState);
    expect(result.current.getWidgetSelectionState(widget)).toEqual(selection);
    expect(renderSpy).toHaveBeenCalledTimes(initialRenderCount + 1);
    expect(legendState.location.query).toEqual({});
  });
});
