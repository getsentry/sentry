import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {useFetchIssueTags} from 'sentry/views/issueList/utils/useFetchIssueTags';

describe('useFetchIssueTags', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
  });

  async function fetchTagValues(organization: Organization) {
    const {result} = renderHookWithProviders(useFetchIssueTags, {
      initialProps: {org: organization, projectIds: []},
      organization,
    });

    await waitFor(() => expect(result.current.tags['issue.type']).toBeDefined());

    const valuesFor = (key: string) =>
      (result.current.tags[key]?.values ?? []).map(value =>
        typeof value === 'string' ? value : value.value
      );

    return {
      issueTypes: valuesFor('issue.type'),
      issueCategories: valuesFor('issue.category'),
    };
  }

  it('offers the LLM cache filters when the issues are visible', async () => {
    const organization = OrganizationFixture({
      features: ['issue-llm-cache-usage-visible'],
    });

    const {issueTypes, issueCategories} = await fetchTagValues(organization);

    expect(issueTypes).toContain(IssueType.LLM_CACHE_USAGE);
    expect(issueCategories).toContain(IssueCategory.GEN_AI);
  });

  it('hides the LLM cache filters when the issues are not visible', async () => {
    const organization = OrganizationFixture({features: []});

    const {issueTypes, issueCategories} = await fetchTagValues(organization);

    expect(issueTypes).not.toContain(IssueType.LLM_CACHE_USAGE);
    expect(issueCategories).not.toContain(IssueCategory.GEN_AI);
  });

  it('hides the LLM cache filters for an org that only runs the detector', async () => {
    // Search resolves neither the category nor the type without the visibility
    // flag, so offering them here would be a filter that always comes back
    // empty for reasons the reader has no way to see.
    const organization = OrganizationFixture({features: ['llm-cache-detection']});

    const {issueTypes, issueCategories} = await fetchTagValues(organization);

    expect(issueTypes).not.toContain(IssueType.LLM_CACHE_USAGE);
    expect(issueCategories).not.toContain(IssueCategory.GEN_AI);
  });
});
