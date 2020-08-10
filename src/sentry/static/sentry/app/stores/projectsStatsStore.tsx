import Reflux from 'reflux';

import {Project} from 'app/types';
import ProjectActions from 'app/actions/projectActions';

type ProjectsStatsStoreInterface = {
  itemsBySlug: Record<string, Project>;

  getInitialState(): ProjectsStatsStoreInterface['itemsBySlug'];
  reset(): void;
  getBySlug(slug: string): Project;
  getAll(): ProjectsStatsStoreInterface['itemsBySlug'];
};

/**
 * This is a store specifically used by the dashboard, so that we can
 * clear the store when the Dashboard unmounts
 * (as to not disrupt ProjectsStore which a lot more components use)
 */
const projectsStatsStore: Reflux.StoreDefinition & ProjectsStatsStoreInterface = {
  itemsBySlug: {},

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

  onStatsLoadSuccess(projects: Project[]) {
    projects.forEach(project => {
      this.itemsBySlug[project.slug] = project;
    });
    this.trigger(this.itemsBySlug);
  },

  /**
   * Optimistic updates
   * @param projectSlug Project slug
   * @param data Project data
   */
  onUpdate(projectSlug: string, data: Project) {
    const project = this.getBySlug(projectSlug);
    this.updatingItems.set(projectSlug, project);
    if (!project) {
      return;
    }

    const newProject: Project = {
      ...project,
      ...data,
    };

    this.itemsBySlug = {
      ...this.itemsBySlug,
      [project.slug]: newProject,
    };
    this.trigger(this.itemsBySlug);
  },

  onUpdateSuccess(data: Project) {
    // Remove project from updating map
    this.updatingItems.delete(data.slug);
  },

  /**
   * Revert project data when there was an error updating project details
   * @param err Error object
   * @param data Previous project data
   */
  onUpdateError(_err: Error, projectSlug: string) {
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
};

type ProjectsStatsStore = Reflux.Store & ProjectsStatsStoreInterface;

export default Reflux.createStore(projectsStatsStore) as ProjectsStatsStore;
