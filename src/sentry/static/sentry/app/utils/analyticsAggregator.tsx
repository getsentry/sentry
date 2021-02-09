import {
  eventNameMap as integrationEventMap,
  EventParameters as IntegrationEventParameters,
} from 'app/utils/integrationUtil';

//TODO: add more types/sources
export type EventParameters = IntegrationEventParameters;

export const allEventMap = {...integrationEventMap};

console.log('allEventMap', allEventMap, integrationEventMap);
