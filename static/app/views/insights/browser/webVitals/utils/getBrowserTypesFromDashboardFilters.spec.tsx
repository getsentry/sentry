import {FieldKind} from 'sentry/utils/fields';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';

import {BrowserType} from './queryParameterDecoders/browserType';
import {getBrowserTypesFromDashboardFilters} from './getBrowserTypesFromDashboardFilters';

function browserFilter(value: string, dataset = WidgetType.SPANS): GlobalFilter {
  return {
    dataset,
    tag: {key: 'browser.name', name: 'browser.name', kind: FieldKind.TAG},
    value,
  };
}

describe('getBrowserTypesFromDashboardFilters', () => {
  it('returns nothing without a browser filter', () => {
    expect(getBrowserTypesFromDashboardFilters(undefined)).toEqual([]);
    expect(getBrowserTypesFromDashboardFilters({})).toEqual([]);
    expect(
      getBrowserTypesFromDashboardFilters({globalFilter: [browserFilter('')]})
    ).toEqual([]);
  });

  it('reads a single browser', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [browserFilter('browser.name:"Chrome Mobile"')],
      })
    ).toEqual([BrowserType.CHROME_MOBILE]);
  });

  it('reads a list of browsers', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [browserFilter('browser.name:[Chrome,"Mobile Safari"]')],
      })
    ).toEqual([BrowserType.CHROME, BrowserType.SAFARI_MOBILE]);
  });

  it('reads the trace metrics filter when spans has none', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [
          browserFilter(''),
          browserFilter('browser.name:Firefox', WidgetType.TRACEMETRICS),
        ],
      })
    ).toEqual([BrowserType.FIREFOX]);
  });

  it('prefers the spans filter when both are set', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [
          browserFilter('browser.name:Firefox', WidgetType.TRACEMETRICS),
          browserFilter('browser.name:Chrome'),
        ],
      })
    ).toEqual([BrowserType.CHROME]);
  });

  it('expands a contains filter to every matching browser', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [
          browserFilter(
            'browser.name:\uF00DContains\uF00DChrome',
            WidgetType.TRACEMETRICS
          ),
        ],
      })
    ).toEqual([BrowserType.CHROME, BrowserType.CHROME_MOBILE]);
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [browserFilter('browser.name:\uF00DContains\uF00Dmobile')],
      })
    ).toEqual([
      BrowserType.CHROME_MOBILE,
      BrowserType.FIREFOX_MOBILE,
      BrowserType.SAFARI_MOBILE,
      BrowserType.EDGE_MOBILE,
      BrowserType.OPERA_MOBILE,
    ]);
  });

  it('returns nothing for a negated filter', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [browserFilter('!browser.name:[Chrome,"Chrome Mobile"]')],
      })
    ).toEqual([]);
  });

  it('returns nothing when a browser is not a known type', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [browserFilter('browser.name:[Chrome,"Samsung Internet"]')],
      })
    ).toEqual([]);
  });

  it('ignores filters on other tags', () => {
    expect(
      getBrowserTypesFromDashboardFilters({
        globalFilter: [
          {
            dataset: WidgetType.SPANS,
            tag: {key: 'transaction', name: 'transaction', kind: FieldKind.TAG},
            value: 'transaction:Chrome',
          },
        ],
      })
    ).toEqual([]);
  });
});
