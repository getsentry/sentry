import { GroupTag } from 'sentry/views/issueDetails/groupTags/useGroupTags';

export function FeatureFlagsFixture(params: GroupTag[] = []): GroupTag[] {
  return [
    {
      key: 'feature.organizations:my-feature',
      name: 'Feature.Organizations:My-Feature',
      totalValues: 11,
      topValues: [
        {
          name: 'true',
          value: 'true',
          count: 7,
          lastSeen: '2025-03-21T18:17:44Z',
          firstSeen: '2025-03-20T16:05:25Z',
        },
        {
          name: 'false',
          value: 'false',
          count: 4,
          lastSeen: '2025-03-21T19:17:44Z',
          firstSeen: '2025-03-15T16:00:00Z',
        },
      ],
    },
    {
      key: 'my-rolled-out-feature',
      name: 'My-Rolled-Out-Feature',
      totalValues: 23,
      topValues: [
        {
          name: 'true',
          value: 'true',
          count: 23,
          lastSeen: '2025-03-21T18:17:44Z',
          firstSeen: '2025-03-21T16:05:25Z',
        },
      ],
    },
    ...params,
  ];
}
