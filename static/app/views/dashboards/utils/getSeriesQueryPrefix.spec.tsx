import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {getSeriesQueryPrefix} from './getSeriesQueryPrefix';

describe('getSeriesQueryPrefix', () => {
  it('returns undefined for single-query widgets', () => {
    const widget = WidgetFixture({
      queries: [WidgetQueryFixture({name: '', conditions: 'browser:Chrome'})],
    });

    expect(getSeriesQueryPrefix(widget.queries[0]!, widget)).toBeUndefined();
  });

  it('returns undefined when the query has an alias', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({name: 'Chrome', conditions: 'browser:Chrome'}),
        WidgetQueryFixture({name: 'Firefox', conditions: 'browser:Firefox'}),
      ],
    });

    expect(getSeriesQueryPrefix(widget.queries[0]!, widget)).toBeUndefined();
  });

  it('returns prettified conditions for multi-query without aliases', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({name: '', conditions: 'browser:Chrome'}),
        WidgetQueryFixture({name: '', conditions: 'browser:Firefox'}),
      ],
    });

    expect(getSeriesQueryPrefix(widget.queries[0]!, widget)).toBe('browser:Chrome');
    expect(getSeriesQueryPrefix(widget.queries[1]!, widget)).toBe('browser:Firefox');
  });

  it('returns undefined when conditions are empty', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({name: '', conditions: ''}),
        WidgetQueryFixture({name: '', conditions: ''}),
      ],
    });

    expect(getSeriesQueryPrefix(widget.queries[0]!, widget)).toBeUndefined();
  });
});
