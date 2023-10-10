import {Environment} from 'sentry/types';

export function Environments(): Environment[] {
  return [
    {id: '1', name: 'production', displayName: 'Production'},
    {id: '2', name: 'staging', displayName: 'Staging'},
    {id: '3', name: 'STAGING', displayName: 'STAGING'},
  ];
}

export function HiddenEnvironments(): Environment[] {
  return [{id: '1', name: 'zzz', displayName: 'ZZZ'}];
}
