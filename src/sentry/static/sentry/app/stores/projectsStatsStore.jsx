import Reflux from 'reflux';

import ProjectActions from 'app/actions/projectActions';

/**
 * This is a store specifically used by the dashboard, so that we can
 * clear the store when the Dashboard unmounts
 * (as to not disrupt ProjectsStore which a lot more components use)
 */
const ProjectsStatsStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(ProjectActions.loadStatsForProjectSuccess, this.onStatsLoadSuccess);
    this.listenTo(ProjectActions.update, this.onUpdate);
    this.listenTo(ProjectActions.updateError, this.onUpdateError);
  },

  getInitialState() {
    return this.itemsBySlug;
  },

  reset() {
    this.itemsBySlug = {};
    this.updatingItems = new Map();
  },

  onStatsLoadSuccess(projects) {
    projects.forEach(project => {
      this.itemsBySlug[project.slug] = project;
    });
    this.trigger(this.itemsBySlug);
  },

  /**
   * Optimistic updates
   * @param {String} projectSlug  Project slug
   * @param {Object} data Project data
   */
  onUpdate(projectSlug, data) {
    const project = this.getBySlug(projectSlug);
    this.updatingItems.set(projectSlug, project);
    if (!project) {
      return;
    }

    const newProject = {
      ...project,
      ...data,
    };

    this.itemsBySlug = {
      ...this.itemsBySlug,
      [project.slug]: newProject,
    };
    this.trigger(this.itemsBySlug);
  },

  onUpdateSuccess(data) {
    // Remove project from updating map
    this.updatingItems.delete(data.slug);
  },

  /**
   * Revert project data when there was an error updating project details
   * @param {Object} err Error object
   * @param {Object} data Previous project data
   */
  onUpdateError(_err, projectSlug) {
    const project = this.updatingItems.get(projectSlug);
    if (!project) {
      return;
    }

    this.updatingItems.delete(projectSlug);
    // Restore old project
    this.itemsBySlug = {
      ...this.itemsBySlug,
      [project.slug]: {...project},
    };
    this.trigger(this.itemsBySlug);
  },

  getAll() {
    return this.itemsBySlug;
  },

  getBySlug(slug) {
    return this.itemsBySlug[slug];
  },
});

export default ProjectsStatsStore;
