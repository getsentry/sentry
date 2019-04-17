import platforms from 'app/data/platforms';

export default function getPlatformName(platform) {
  const platformData = platforms.find(({id}) => platform == id);
  return platformData && platformData.name;
}
