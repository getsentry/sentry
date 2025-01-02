import type {StoreDefinition} from 'reflux';
import {createStore} from 'reflux';

import type {Project} from 'sentry/types/project';

interface ProjectsStatsStoreDefinition extends StoreDefinition {
  getAll(): ProjectsStatsStoreDefinition['itemsBySlug'];

  getBySlug(slug: string): Project;
  getInitialState(): ProjectsStatsStoreDefinition['itemsBySlug'];
  itemsBySlug: Record<string, Project>;
  onStatsLoadSuccess(projects: Project[]): void;
  onUpdate(projectSlug: string, data: Partial<Project>): void;
  onUpdateError(err: Error, projectSlug: string): void;
  reset(): void;
}

/**
 * This is a store specifically used by the dashboard, so that we can
 * clear the store when the Dashboard unmounts
 * (as to not disrupt ProjectsStore which a lot more components use)
 */
const storeConfig: ProjectsStatsStoreDefinition = {
  itemsBySlug: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
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
   * @param projectSlug Project slug
   * @param data Project data
   */
  onUpdate(projectSlug, data) {
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
    return this.itemsBySlug[slug]!;
  },
};

const ProjectsStatsStore = createStore(storeConfig);
export default ProjectsStatsStore;
