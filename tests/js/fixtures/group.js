import {Project} from './project';

export function Group(params = {}) {
  let project = Project();
  return {
    id: '1',
    stats: {
      '24h': [[1517281200, 2], [1517310000, 1]],
      '30d': [[1514764800, 1], [1515024000, 122]],
    },
    project: {
      id: project.id,
      slug: project.slug,
    },
    tags: [],
    assignedTo: null,
    ...params,
  };
}
