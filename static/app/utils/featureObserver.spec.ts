import {OrganizationFixture} from 'sentry-fixture/organization';

import FeatureObserver from 'sentry/utils/featureObserver';

describe('FeatureObserver', () => {
  let organization;
  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['enable-issues', 'enable-profiling', 'enable-replay'],
    });
  });

  describe('observeFlags', () => {
    it('should add recently evaluated flags to the flag queue', () => {
      const inst = new FeatureObserver();
      expect(organization.features).toEqual([
        'enable-issues',
        'enable-profiling',
        'enable-replay',
      ]);

      inst.observeFlags({organization, bufferSize: 3});
      expect(inst.getFeatureFlags().values).toEqual([]);

      organization.features.includes('enable-issues');
      organization.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'enable-issues', result: true},
        {flag: 'replay-mobile-ui', result: false},
      ]);

      // do more evaluations to fill up and overflow the buffer
      organization.features.includes('enable-replay');
      organization.features.includes('autofix-ui');
      organization.features.includes('new-issue-details');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'enable-replay', result: true},
        {flag: 'autofix-ui', result: false},
        {flag: 'new-issue-details', result: false},
      ]);
    });

    it('should remove duplicate flags', () => {
      const inst = new FeatureObserver();
      inst.observeFlags({organization, bufferSize: 3});
      expect(inst.getFeatureFlags().values).toEqual([]);

      organization.features.includes('enable-issues');
      organization.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'enable-issues', result: true},
        {flag: 'replay-mobile-ui', result: false},
      ]);

      // this is already in the queue; it should be removed and
      // added back to the end of the queue
      organization.features.includes('enable-issues');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'replay-mobile-ui', result: false},
        {flag: 'enable-issues', result: true},
      ]);

      organization.features.includes('spam-ingest');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'replay-mobile-ui', result: false},
        {flag: 'enable-issues', result: true},
        {flag: 'spam-ingest', result: false},
      ]);

      // this is already in the queue but in the back
      // the queue should not change
      organization.features.includes('spam-ingest');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'replay-mobile-ui', result: false},
        {flag: 'enable-issues', result: true},
        {flag: 'spam-ingest', result: false},
      ]);
    });

    it('should not change the functionality of `includes`', () => {
      const inst = new FeatureObserver();
      inst.observeFlags({organization, bufferSize: 3});
      expect(inst.getFeatureFlags().values).toEqual([]);

      organization.features.includes('enable-issues');
      organization.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'enable-issues', result: true},
        {flag: 'replay-mobile-ui', result: false},
      ]);

      expect(organization.features.includes('enable-issues')).toBe(true);
      expect(organization.features.includes('replay-mobile-ui')).toBe(false);
    });
  });
});
