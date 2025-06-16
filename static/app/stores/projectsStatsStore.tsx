import {createStore} from 'reflux';

import type {Project} from 'sentry/types/project';

import type {StrictStoreDefinition} from './types';

type SlugStatsMapping = Record<string, Project>;
type State = SlugStatsMapping;

interface ProjectsStatsStoreDefinition extends StrictStoreDefinition<State> {
  getAll(): SlugStatsMapping;
  getBySlug(slug: string): Project;
  getInitialState(): SlugStatsMapping;
  onStatsLoadSuccess(projects: Project[]): void;
  onUpdate(projectSlug: string, data: Partial<Project>): void;
  onUpdateError(err: Error, projectSlug: string): void;
  onUpdateSuccess(data: Project): void;
  reset(): void;
  updatingItems: Map<string, Project>;
}

/**
 * This is a store specifically used by the dashboard, so that we can
 * clear the store when the Dashboard unmounts
 * (as to not disrupt ProjectsStore which a lot more components use)
 */
const storeConfig: ProjectsStatsStoreDefinition = {
  state: {},
  updatingItems: new Map(),

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  getInitialState() {
    return this.state;
  },

  reset() {
    this.state = {};
    this.updatingItems.clear();
  },

  onStatsLoadSuccess(projects) {
    projects.forEach(project => {
      this.state = {...this.state, [project.slug]: project};
    });
    this.trigger(this.state);
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

    this.state = {
      ...this.state,
      [project.slug]: newProject,
    };
    this.trigger(this.state);
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
    this.state = {
      ...this.state,
      [project.slug]: {...project},
    };
    this.trigger(this.state);
  },

  getAll() {
    return this.state;
  },

  getState() {
    return this.state;
  },

  getBySlug(slug) {
    return this.state[slug]!;
  },
};

const ProjectsStatsStore = createStore(storeConfig);
export default ProjectsStatsStore;
