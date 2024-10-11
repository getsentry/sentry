import type {Location} from 'history';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import DashboardLegendEncoderDecoder from './dashboardLegendUtils';

describe('WidgetLegend functions util', () => {
  let legendFunctions: DashboardLegendEncoderDecoder;

  // beforeEach(() => {
  //   legendFunctions = new WidgetLegendFunctions();
  // });

  describe('legendChanges', function () {
    let widget: Widget;
    let location: Location;
    let organization: Organization;
    let dashboard: DashboardDetails;
    let router: InjectedRouter;
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
      location = {
        ...LocationFixture(),
        query: {
          unselectedSeries: ['12345-Releases'],
        },
      };
      organization = {
        ...OrganizationFixture(),
        features: ['dashboards-releases-on-charts'],
      };

      dashboard = {
        ...DashboardFixture([widget, {...widget, id: '23456'}]),
      };

      router = {
        ...RouterFixture({location}),
      };

      legendFunctions = new DashboardLegendEncoderDecoder({
        dashboard,
        location,
        organization,
        router,
      });
    });

    it('set initial unselected legend options', () => {
      expect(legendFunctions.getLegendUnselected(widget)).toEqual({
        'Releases:12345': false,
      });
    });

    it('updates legend query param when legend option toggled', () => {
      legendFunctions.updateLegendQueryParam({'Releases:12345': true}, widget);
      expect(router.replace).toHaveBeenCalledWith({
        query: {unselectedSeries: ['12345-']},
      });
    });

    it('updates legend query param when legend option toggled but not in query params', () => {
      location = {...location, query: {...location.query, unselectedSeries: []}};

      legendFunctions.updateLegendQueryParam(
        {'Releases:12345': false, 'count():12345': true},
        widget
      );
      expect(router.replace).toHaveBeenCalledWith({
        query: {unselectedSeries: ['12345-Releases']},
      });
    });

    it('gives updated query param when widget change submitted', () => {
      expect(legendFunctions.updatedLegendQueryOnWidgetChange(dashboard)).toEqual([
        '12345-Releases',
        '23456-Releases',
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
        legendFunctions.encodeLegendQueryParam(widget, {[`Releases:${widget.id}`]: false})
      ).toEqual(`${widget.id}-Releases`);
    });

    it('formats to selected format from query param', () => {
      expect(legendFunctions.decodeLegendQueryParam(widget)).toEqual({
        [`Releases:${widget.id}`]: false,
      });
    });
  });
});
