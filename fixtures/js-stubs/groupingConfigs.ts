import type {EventGroupingConfig} from 'sentry/types';

export function GroupingConfigs(): EventGroupingConfig[] {
  return [
    {
      id: 'default:XXXX',
      base: null,
      changelog: '',
      delegates: [],
      hidden: false,
      latest: true,
      risk: 1,
      strategies: [],
    },
  ];
}
