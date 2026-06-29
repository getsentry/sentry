import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

export function SupergroupDetailFixture(
  params: Partial<SupergroupDetail> = {}
): SupergroupDetail {
  return {
    id: 1,
    title: 'Test Supergroup',
    summary: 'A test supergroup',
    error_type: 'TypeError',
    code_area: 'frontend',
    group_ids: [1, 2, 3],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...params,
  };
}
