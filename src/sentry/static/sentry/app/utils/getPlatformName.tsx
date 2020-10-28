import platforms from 'app/data/platforms';

export default function getPlatformName(platform: string): string | null {
  const platformData: {name: string} | undefined = platforms.find(
    ({id}) => platform === id
  );
  return platformData ? platformData.name : null;
}
