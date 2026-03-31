import {allPlatforms as platforms} from 'sentry/data/platforms';

export function getPlatformName(platform: string | null) {
  const platformData: {name: string} | undefined = platforms.find(
    ({id}) => platform === id
  );
  return platformData ? platformData.name : null;
}
