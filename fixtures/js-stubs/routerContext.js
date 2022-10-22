import * as PropTypes from 'prop-types';

import {location} from './location';
import {Organization} from './organization';
import {Project} from './project';
import {router} from './router';

export function routerContext([context, childContextTypes] = []) {
  return {
    context: {
      location: location(),
      router: router(),
      organization: Organization(),
      project: Project(),
      ...context,
    },
    childContextTypes: {
      router: PropTypes.object,
      location: PropTypes.object,
      organization: PropTypes.object,
      project: PropTypes.object,
      ...childContextTypes,
    },
  };
}
