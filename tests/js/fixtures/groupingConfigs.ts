import type {EventGroupingConfig} from 'sentry/types/event';

export function GroupingConfigsFixture(): EventGroupingConfig[] {
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
