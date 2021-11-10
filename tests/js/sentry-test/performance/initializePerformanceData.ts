import {initializeOrg} from 'sentry-test/initializeOrg';

import {Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';

export function initializeData(settings?: {
  query?: {};
  features?: string[];
  projects?: Project[];
  project?: Project;
}) {
  const _defaultProject = TestStubs.Project();
  const _settings = {
    query: {},
    features: [],
    projects: [_defaultProject],
    project: _defaultProject,
    ...settings,
  };
  const {query, features} = _settings;

  const projects = [TestStubs.Project()];
  const [project] = projects;

  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const router = {
    location: {
      query: {
        ...query,
      },
    },
  };
  const initialData = initializeOrg({organization, projects, project, router});
  const location = initialData.router.location;
  const eventView = EventView.fromLocation(location);

  return {...initialData, location, eventView};
}
