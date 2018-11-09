export function getProjectSelectorType(model) {
  // assume that a team has key `projects` while a project has key `teams`
  return typeof model.projects !== 'undefined' ? 'team' : 'project';
}
