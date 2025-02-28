import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import {experimentConfig, unassignedValue} from 'sentry/data/experimentConfig';
import ConfigStore from 'sentry/stores/configStore';
import type {ExperimentKey} from 'sentry/types/experiments';
import {ExperimentType} from 'sentry/types/experiments';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import localStorage from 'sentry/utils/localStorage';

// the local storage key that stores which experiments we've logged
const SENTRY_EXPERIMENTS_KEY = 'logged-sentry-experiments';

const unitNameMap = {
  organization: 'org_id',
  user: 'user_id',
} as const;

type Options = {
  /**
   * The experiment key
   */
  key: ExperimentKey;
  /**
   * The organization for org based experiments
   */
  organization?: Organization;
};

/**
 * Log exposure to an experiment.
 *
 * Generally you will want to call this just before the logic to determine the
 * variant or exposure of a particular experiment.
 */
export default async function logExperiment({key, organization}: Options) {
  // Never log experiments for super users
  const user = ConfigStore.get('user');
  if (user.isSuperuser) {
    return;
  }

  const config = experimentConfig[key];

  if (config === undefined) {
    return;
  }

  const {type, parameter} = config;

  const assignment =
    type === ExperimentType.ORGANIZATION
      ? organization?.experiments?.[key]
      : type === ExperimentType.USER
        ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          user.experiments?.[key]
        : null;

  // Nothing to log if there is no assignment
  if (!defined(assignment)) {
    return;
  }

  // Do not log if the assignment matches the unassigned group constant
  if (assignment === unassignedValue) {
    return;
  }

  const unitId =
    type === ExperimentType.ORGANIZATION
      ? Number(organization?.id)
      : type === ExperimentType.USER
        ? Number(user.id)
        : null;

  // if the value of this experiment matches the stored value, we can
  // skip calling log_exposure
  if (getExperimentLogged(key) === unitId) {
    return;
  }

  const data = {
    experiment_name: key,
    unit_name: unitNameMap[type],
    unit_id: unitId,
    params: {[parameter]: assignment},
  };

  const client = new Client({baseUrl: ''});

  try {
    await client.requestPromise('/_experiment/log_exposure/', {
      method: 'POST',
      data,
    });
    // update local storage with the new experiment we've logged
    setExperimentLogged(key, unitId);
  } catch (error) {
    Sentry.withScope(scope => {
      scope.setExtra('data', data);
      scope.setExtra('error', error);
      Sentry.captureException(new Error('Could not log experiment'));
    });
  }
}

const getExperimentsLogged = () => {
  try {
    const localStorageExperiments = localStorage.getItem(SENTRY_EXPERIMENTS_KEY);
    const jsonData: unknown = JSON.parse(localStorageExperiments || '{}');
    if (typeof jsonData === 'object' && !Array.isArray(jsonData) && jsonData !== null) {
      return jsonData;
    }
  } catch (err) {
    // some sort of malformed json
    Sentry.captureException(err);
  }
  // by default, return an empty config
  return {};
};

const getExperimentLogged = (key: string) => {
  const experimentData = getExperimentsLogged();
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return experimentData[key];
};

const setExperimentLogged = (key: string, unitId: number | null) => {
  // shouldn't be null but need to make TS happy
  if (unitId === null) {
    return;
  }
  const experimentData = {...getExperimentsLogged(), [key]: unitId};
  localStorage.setItem(SENTRY_EXPERIMENTS_KEY, JSON.stringify(experimentData));
};
