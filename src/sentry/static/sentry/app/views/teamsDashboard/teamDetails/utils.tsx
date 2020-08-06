import set from 'lodash/set';

import {LocalStorageDashboardType} from '../types';

export const ENVIRONMENT_KEY = 'environments';

export const getSelectedEnvironments = (
  teamSlug: string,
  data: LocalStorageDashboardType | undefined
): string[] => {
  if (!data) {
    return [];
  }

  const teamData = data[teamSlug] ?? {};

  return teamData[ENVIRONMENT_KEY] ?? [];
};

const TEAM_DESCRIPTION_KEY = 'team_description';

export const getTeamDescription = (
  teamSlug: string,
  data: LocalStorageDashboardType | undefined
): string | undefined => {
  if (!data) {
    return undefined;
  }

  const teamData = data[teamSlug] ?? {};

  return teamData[TEAM_DESCRIPTION_KEY];
};

export const setTeamDescription = (
  setLs: (key: string, data: any) => void,
  teamSlug: string,
  data: LocalStorageDashboardType | undefined,
  description: string | undefined
) => {
  if (!data) {
    return;
  }

  const teamData = data[teamSlug] ?? {};

  const nextState = set(teamData, [TEAM_DESCRIPTION_KEY], description);

  setLs(teamSlug, nextState);
};
