import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {getCurrentLandingDisplay} from 'sentry/views/performance/landing/utils';

function initializeData(projects: Project[], query: any = {}) {
  const organization = OrganizationFixture({
    features: [],
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: query || {},
      },
    },
    projects,
  });
  const eventView = EventView.fromLocation(initialData.router.location);
  ProjectsStore.loadInitialData(initialData.projects);
  return {
    ...initialData,
    eventView,
  };
}

describe('Utils', function () {
  describe('getCurrentLandingDisplay()', function () {
    it('returns all by default', function () {
      const projects = [ProjectFixture()];
      const data = initializeData(projects);
      expect(getCurrentLandingDisplay(data.router.location, projects).label).toBe(
        'All Transactions'
      );
    });
    it('returns specific landing display if query is set', function () {
      const projects = [ProjectFixture()];
      const data = initializeData(projects, {landingDisplay: 'frontend_pageload'});
      expect(getCurrentLandingDisplay(data.router.location, projects).label).toBe(
        'All Transactions'
      );
    });
    it('returns frontend display if project matches', function () {
      const projects = [ProjectFixture({id: '22', platform: 'javascript-react'})];
      const data = initializeData(projects, {project: 22});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toBe('Frontend');
    });
    it('returns backend display if project matches', function () {
      const projects = [ProjectFixture({id: '22', platform: 'php'})];
      const data = initializeData(projects, {project: 22});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toBe('Backend');
    });
    it('returns all display for native platform', function () {
      const projects = [ProjectFixture({id: '22', platform: 'native'})];
      const data = initializeData(projects, {project: [22]});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toBe('All Transactions');
    });
    it('returns all display if multiple projects', function () {
      const projects = [ProjectFixture()];
      const data = initializeData(projects, {project: [1, 2]});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toBe('All Transactions');
    });
  });
});
