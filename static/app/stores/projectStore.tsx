import {createStore} from 'reflux';

import {Project} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

type State = {
  data: undefined | Project;
  error: undefined;
  loading: false;
};

const initialState: State = {
  error: undefined,
  loading: false,
  data: undefined,
};

interface ProjectStoreDefinition extends CommonStoreDefinition<State> {
  fetchProjectError: (error: string) => void;
  fetchProjectStart: () => void;
  fetchProjectSuccess: (data: Project) => void;

  reset(): void;
}

const storeConfig: ProjectStoreDefinition = {
  state: initialState,

  reset() {
    this.state = initialState;
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },

  fetchProjectStart() {
    this.state = {
      ...this.state,
      error: undefined,
      loading: true,
      data: undefined,
    };
    this.trigger(this.state);
  },

  fetchProjectSuccess(data: Project) {
    this.state = {
      ...this.state,
      error: undefined,
      loading: false,
      data,
    };
    this.trigger(this.state);
  },

  fetchProjectError(error: string) {
    this.state = {
      ...this.state,
      error,
      loading: false,
      data: undefined,
    };
    this.trigger(this.state);
  },
};

export const ProjectStore = createStore(makeSafeRefluxStore(storeConfig));
