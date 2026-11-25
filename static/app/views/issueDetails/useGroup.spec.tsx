import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useGroup} from './useGroup';

describe('useGroup', () => {
  const group = GroupFixture();

  it.each([
    {features: [], expandsDerivedData: false},
    {features: ['issue-inbox'], expandsDerivedData: true},
    {features: ['seer-impact-assessment'], expandsDerivedData: true},
  ])(
    'expands derived data with features $features: $expandsDerivedData',
    async ({features, expandsDerivedData}) => {
      const request = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/issues/${group.id}/`,
        body: group,
      });

      const {result} = renderHookWithProviders(() => useGroup({groupId: group.id}), {
        organization: OrganizationFixture({features}),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const expand = request.mock.calls[0][1].query.expand;
      expect(expand.includes('derivedData')).toBe(expandsDerivedData);
    }
  );
});
