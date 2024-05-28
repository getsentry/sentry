import {Environment} from 'sentry/types/project';

export function EnvironmentsFixture(): Environment[] {
  return [
    {id: '1', name: 'production', displayName: 'Production'},
    {id: '2', name: 'staging', displayName: 'Staging'},
    {id: '3', name: 'STAGING', displayName: 'STAGING'},
  ];
}

export function HiddenEnvironmentsFixture(): Environment[] {
  return [{id: '1', name: 'zzz', displayName: 'ZZZ'}];
}
