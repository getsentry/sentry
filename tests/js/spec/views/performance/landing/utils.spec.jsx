import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {getCurrentLandingDisplay} from 'sentry/views/performance/landing/utils';

function initializeData(projects, query) {
  const organization = TestStubs.Organization({
    features: [],
    projects,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: query || {},
      },
    },
  });
  const eventView = EventView.fromLocation(initialData.router.location);
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return {
    ...initialData,
    eventView,
  };
}

describe('Utils', function () {
  describe('getCurrentLandingDisplay()', function () {
    it('returns all by default', function () {
      const projects = [TestStubs.Project()];
      const data = initializeData(projects);
      expect(getCurrentLandingDisplay(data.router.location, projects).label).toEqual(
        'All Transactions'
      );
    });
    it('returns specific landing display if query is set', function () {
      const projects = [TestStubs.Project()];
      const data = initializeData(projects, {landingDisplay: 'frontend_pageload'});
      expect(getCurrentLandingDisplay(data.router.location, projects).label).toEqual(
        'Web Vitals'
      );
    });
    it('returns frontend display if project matches', function () {
      const projects = [TestStubs.Project({id: '22', platform: 'javascript-react'})];
      const data = initializeData(projects, {project: 22});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toEqual('Web Vitals');
    });
    it('returns backend display if project matches', function () {
      const projects = [TestStubs.Project({id: '22', platform: 'php'})];
      const data = initializeData(projects, {project: 22});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toEqual('Backend');
    });
    it('returns all display for native platform', function () {
      const projects = [TestStubs.Project({id: '22', platform: 'native'})];
      const data = initializeData(projects, {project: [22]});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toEqual('All Transactions');
    });
    it('returns all display if multiple projects', function () {
      const projects = [TestStubs.Project()];
      const data = initializeData(projects, {project: [1, 2]});
      expect(
        getCurrentLandingDisplay(data.router.location, projects, data.eventView).label
      ).toEqual('All Transactions');
    });
  });
});
