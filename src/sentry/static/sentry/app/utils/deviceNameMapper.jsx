import iOSDeviceList from 'ios-device-list';

export default function(model) {
  if (!model) {
    return null;
  }
  const modelIdentifier = model.split(' ')[0];
  const modelId = model.split(' ').splice(1).join(' ');
  const modelName = iOSDeviceList.generationByIdentifier(modelIdentifier);
  return modelName === undefined ? model : modelName + ' ' + modelId;
}
