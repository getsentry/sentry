import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import FeatureObserver from 'sentry/utils/featureObserver';

describe('FeatureObserver', () => {
  let organization: Organization;
  let project: Project;

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['enable-issues', 'enable-profiling', 'enable-replay'],
    });
    project = ProjectFixture({
      features: ['enable-proj-flag', 'enable-performance'],
    });
  });

  describe('observeOrganizationFlags', () => {
    it('should add recently evaluated org flags to the flag queue', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      expect(organization.features).toEqual([
        'enable-issues',
        'enable-profiling',
        'enable-replay',
      ]);

      inst.observeOrganizationFlags({organization});
      expect(inst.getFeatureFlags().values).toEqual([]);

      organization.features.includes('enable-issues');
      organization.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.organizations:replay-mobile-ui', result: false},
      ]);

      // do more evaluations to fill up and overflow the buffer
      organization.features.includes('enable-replay');
      organization.features.includes('autofix-ui');
      organization.features.includes('new-issue-details');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:enable-replay', result: true},
        {flag: 'feature.organizations:autofix-ui', result: false},
        {flag: 'feature.organizations:new-issue-details', result: false},
      ]);
    });

    it('should remove duplicate flags with a full queue', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      inst.observeOrganizationFlags({organization});
      expect(inst.getFeatureFlags().values).toEqual([]);

      organization.features.includes('enable-issues');
      organization.features.includes('replay-mobile-ui');
      organization.features.includes('enable-discover');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.organizations:replay-mobile-ui', result: false},
        {flag: 'feature.organizations:enable-discover', result: false},
      ]);

      // this is already in the queue; it should be removed and
      // added back to the end of the queue
      organization.features.includes('enable-issues');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:replay-mobile-ui', result: false},
        {flag: 'feature.organizations:enable-discover', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
      ]);

      organization.features.includes('spam-ingest');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:enable-discover', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.organizations:spam-ingest', result: false},
      ]);

      // this is already in the queue but in the back
      // the queue should not change
      organization.features.includes('spam-ingest');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:enable-discover', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.organizations:spam-ingest', result: false},
      ]);
    });

    it('should remove duplicate flags with an unfilled queue', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      inst.observeOrganizationFlags({organization});
      expect(inst.getFeatureFlags().values).toEqual([]);

      organization.features.includes('enable-issues');
      organization.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.organizations:replay-mobile-ui', result: false},
      ]);

      // this is already in the queue; it should be removed and
      // added back to the end of the queue
      organization.features.includes('enable-issues');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:replay-mobile-ui', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
      ]);

      // this is already in the queue but in the back
      // the queue should not change
      organization.features.includes('enable-issues');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:replay-mobile-ui', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
      ]);
    });

    it('should not change the functionality of `includes`', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      inst.observeOrganizationFlags({organization});
      expect(inst.getFeatureFlags().values).toEqual([]);

      organization.features.includes('enable-issues');
      organization.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.organizations:replay-mobile-ui', result: false},
      ]);

      expect(organization.features.includes('enable-issues')).toBe(true);
      expect(organization.features.includes('replay-mobile-ui')).toBe(false);
    });
  });

  describe('observeProjectFlags', () => {
    it('should add recently evaluated proj flags to the flag queue', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      expect(project.features).toEqual(['enable-proj-flag', 'enable-performance']);

      inst.observeProjectFlags({project});
      expect(inst.getFeatureFlags().values).toEqual([]);

      project.features.includes('enable-proj-flag');
      project.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-proj-flag', result: true},
        {flag: 'feature.projects:replay-mobile-ui', result: false},
      ]);

      // do more evaluations to fill up and overflow the buffer
      project.features.includes('enable-performance');
      project.features.includes('autofix-ui');
      project.features.includes('new-issue-details');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-performance', result: true},
        {flag: 'feature.projects:autofix-ui', result: false},
        {flag: 'feature.projects:new-issue-details', result: false},
      ]);
    });

    it('should not change the functionality of `includes`', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      inst.observeProjectFlags({project});
      expect(inst.getFeatureFlags().values).toEqual([]);

      project.features.includes('enable-proj-flag');
      project.features.includes('replay-mobile-ui');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-proj-flag', result: true},
        {flag: 'feature.projects:replay-mobile-ui', result: false},
      ]);

      expect(project.features.includes('enable-proj-flag')).toBe(true);
      expect(project.features.includes('replay-mobile-ui')).toBe(false);
    });
  });

  describe('observeProjectFlags and observeOrganizationFlags', () => {
    it('should add recently evaluated org and proj flags to the flag queue', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      expect(project.features).toEqual(['enable-proj-flag', 'enable-performance']);
      expect(organization.features).toEqual([
        'enable-issues',
        'enable-profiling',
        'enable-replay',
      ]);

      inst.observeProjectFlags({project});
      inst.observeOrganizationFlags({organization});
      expect(inst.getFeatureFlags().values).toEqual([]);

      project.features.includes('enable-proj-flag');
      project.features.includes('enable-replay');
      organization.features.includes('enable-issues');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-proj-flag', result: true},
        {flag: 'feature.projects:enable-replay', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
      ]);

      organization.features.includes('enable-replay');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-replay', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.organizations:enable-replay', result: true},
      ]);
    });

    it('should keep the same queue if the project changes', () => {
      const inst = new FeatureObserver({bufferSize: 3});
      expect(project.features).toEqual(['enable-proj-flag', 'enable-performance']);
      expect(organization.features).toEqual([
        'enable-issues',
        'enable-profiling',
        'enable-replay',
      ]);

      inst.observeProjectFlags({project});
      inst.observeOrganizationFlags({organization});
      expect(inst.getFeatureFlags().values).toEqual([]);

      project.features.includes('enable-proj-flag');
      project.features.includes('enable-replay');
      organization.features.includes('enable-issues');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-proj-flag', result: true},
        {flag: 'feature.projects:enable-replay', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
      ]);

      project = ProjectFixture({
        features: ['enable-new-flag'],
      });
      inst.observeProjectFlags({project});
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-proj-flag', result: true},
        {flag: 'feature.projects:enable-replay', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
      ]);

      project.features.includes('enable-new-flag');
      expect(inst.getFeatureFlags().values).toEqual([
        {flag: 'feature.projects:enable-replay', result: false},
        {flag: 'feature.organizations:enable-issues', result: true},
        {flag: 'feature.projects:enable-new-flag', result: true},
      ]);
    });
  });
});
