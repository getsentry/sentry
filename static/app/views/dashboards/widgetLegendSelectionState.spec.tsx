import type {Location} from 'history';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {Organization} from 'sentry/types/organization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import WidgetLegendSelectionState from './widgetLegendSelectionState';

const WIDGET_ID_DELIMITER = ':';
const SERIES_NAME_DELIMITER = ';';

describe('WidgetLegend functions util', () => {
  let legendFunctions: WidgetLegendSelectionState;

  describe('legendChanges', function () {
    let widget: Widget;
    let location: Location;
    let organization: Organization;
    let dashboard: DashboardDetails;
    let mockNavigate: jest.Mock;
    beforeEach(() => {
      mockNavigate = jest.fn();
      widget = {
        id: '12345',
        title: 'Test Query',
        displayType: DisplayType.AREA,
        widgetType: WidgetType.ERRORS,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['count()', 'Releases'],
            aggregates: ['count()', 'Releases'],
            columns: [],
            orderby: '',
          },
        ],
      };
      location = {
        ...LocationFixture(),
        query: {
          unselectedSeries: [`12345${WIDGET_ID_DELIMITER}Releases`],
        },
      };
      organization = {
        ...OrganizationFixture(),
      };

      dashboard = {
        ...DashboardFixture([widget, {...widget, id: '23456'}]),
      };

      legendFunctions = new WidgetLegendSelectionState({
        dashboard,
        location,
        organization,
        navigate: mockNavigate,
      });
    });

    it('set initial unselected legend options', () => {
      expect(legendFunctions.getWidgetSelectionState(widget)).toEqual({
        [`Releases${SERIES_NAME_DELIMITER}12345`]: false,
      });
    });

    it('updates legend query param when legend option toggled', () => {
      legendFunctions.setWidgetSelectionState({'Releases:12345': true}, widget);
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {unselectedSeries: [`12345${WIDGET_ID_DELIMITER}`]},
        }),
        {preventScrollReset: true, replace: true}
      );
    });

    it('updates legend query param when legend option toggled but not in query params', () => {
      location = {...location, query: {...location.query, unselectedSeries: []}};

      legendFunctions.setWidgetSelectionState(
        {
          [`Releases${SERIES_NAME_DELIMITER}12345`]: false,
          [`count()${SERIES_NAME_DELIMITER}12345`]: true,
        },
        widget
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {unselectedSeries: [`12345${WIDGET_ID_DELIMITER}Releases`]},
        }),
        {preventScrollReset: true, replace: true}
      );
    });

    it('gives updated query param when widget change submitted', () => {
      expect(legendFunctions.setMultipleWidgetSelectionStateURL(dashboard)).toEqual([
        `12345${WIDGET_ID_DELIMITER}Releases`,
        `23456${WIDGET_ID_DELIMITER}Releases`,
      ]);
    });
  });

  describe('legend naming', function () {
    let widget: Widget;
    beforeEach(() => {
      widget = {
        id: '12345',
        title: 'Test Query',
        displayType: DisplayType.AREA,
        widgetType: WidgetType.ERRORS,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['count()', 'Releases'],
            aggregates: ['count()', 'Releases'],
            columns: [],
            orderby: '',
          },
        ],
      };
    });

    it('formats to query param format from selected', () => {
      expect(
        legendFunctions.encodeLegendQueryParam(widget, {
          [`Releases${SERIES_NAME_DELIMITER}${widget.id}`]: false,
        })
      ).toBe(`${widget.id}${WIDGET_ID_DELIMITER}Releases`);
    });

    it('formats to selected format from query param', () => {
      expect(legendFunctions.decodeLegendQueryParam(widget)).toEqual({
        [`Releases${SERIES_NAME_DELIMITER}${widget.id}`]: false,
      });
    });
  });
});
