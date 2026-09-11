import {LocationFixture} from 'sentry-fixture/locationFixture';

import {getLandingDisplayFromParam} from 'sentry/views/performance/landing/utils';

describe('getLandingDisplayFromParam', () => {
  it('returns undefined without a landing display', () => {
    expect(getLandingDisplayFromParam(LocationFixture())).toBeUndefined();
  });

  it('returns the selected landing display', () => {
    expect(
      getLandingDisplayFromParam(
        LocationFixture({query: {landingDisplay: 'frontend_other'}})
      )
    ).toEqual({field: 'frontend_other', label: 'Frontend'});
  });
});
