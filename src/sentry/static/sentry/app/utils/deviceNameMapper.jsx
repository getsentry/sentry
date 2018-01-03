import iOSDeviceList from 'ios-device-list';
import {isString} from 'lodash';

export default function(model) {
  if (!model || !isString(model)) {
    return null;
  }
  const modelIdentifier = model.split(' ')[0];
  const modelId = model
    .split(' ')
    .splice(1)
    .join(' ');
  const modelName = iOSDeviceList.generationByIdentifier(modelIdentifier);
  return modelName === undefined ? model : modelName + ' ' + modelId;
}
