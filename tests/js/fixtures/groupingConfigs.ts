import type {EventGroupingConfig} from 'sentry/types/event';

export function GroupingConfigsFixture(): EventGroupingConfig[] {
  return [
    {
      id: 'default:XXXX',
      base: null,
      delegates: [],
      strategies: [],
    },
  ];
}
