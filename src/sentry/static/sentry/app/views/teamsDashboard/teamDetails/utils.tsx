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
