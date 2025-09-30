import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {
  EventSearch,
  useEventQuery,
} from 'sentry/views/issueDetails/streamline/eventSearch';

const mockHandleSearch = jest.fn();

describe('EventSearch', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['production', 'staging', 'developement'],
  });
  const group = GroupFixture({id: 'group-id'});
  const defaultProps = {
    environments: project.environments,
    group,
    handleSearch: mockHandleSearch,
    query: '',
  };
  const [tagKey, tagValue] = ['user.email', 'leander@s.io'];
  let mockTagKeyQuery: jest.Mock;
  let mockTagsRequest: jest.Mock;

  beforeEach(() => {
    OrganizationStore.onUpdate(organization, {replace: true});
    MockApiClient.clearMockResponses();
    mockTagsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
    mockTagKeyQuery = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/${tagKey}/values/`,
      body: [
        {
          key: tagKey,
          name: tagValue,
          value: tagValue,
        },
      ],
      method: 'GET',
    });
  });

  it('handles basic inputs for tags', async () => {
    render(<EventSearch {...defaultProps} />);
    const search = screen.getByRole('combobox', {name: 'Add a search term'});
    expect(search).toBeInTheDocument();
    await userEvent.type(search, `${tagKey}:`);
    await userEvent.keyboard(`${tagValue}{enter}{enter}`);

    await waitFor(() => {
      expect(mockTagKeyQuery).toHaveBeenCalled();
    });
    expect(mockHandleSearch).toHaveBeenCalledWith(
      `${tagKey}:${tagValue}`,
      expect.anything()
    );
  }, 10_000);

  it('filters issue tokens from event queries', async () => {
    const validQuery = `${tagKey}:${tagValue} device.family:[iphone,pixel]`;

    const {result: onlyIssueTokens} = renderHookWithProviders(
      () => useEventQuery({groupId: group.id}),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/test/',
            query: {query: 'is:resolved assigned:[me,#issues] issue.priority:high'},
          },
        },
      }
    );
    expect(onlyIssueTokens.current).toBe('');

    const {result: combinedTokens} = renderHookWithProviders(
      () => useEventQuery({groupId: group.id}),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/test/',
            query: {query: `is:resolved assigned:[me,#issues] ${validQuery}`},
          },
        },
      }
    );
    expect(combinedTokens.current).toBe(validQuery);

    const {result: onlyEventTokens} = renderHookWithProviders(
      () => useEventQuery({groupId: group.id}),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/test/',
            query: {query: validQuery},
          },
        },
      }
    );
    expect(onlyEventTokens.current).toBe(validQuery);

    const {result: unrecognizedFilterKey} = renderHookWithProviders(
      () => useEventQuery({groupId: group.id}),
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/test/',
            // This isn't in the TagsFixture or ISSUE_EVENT_PROPERTY_FIELDS
            query: {query: `${validQuery} organization.slug:sentry`},
          },
        },
      }
    );
    await waitFor(() => expect(unrecognizedFilterKey.current).toBe(validQuery));
  });

  it('keeps event filter from "is:unresolved level:error" and only makes one request', async () => {
    const {result} = renderHookWithProviders(() => useEventQuery({groupId: group.id}), {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/test/',
          query: {query: 'is:unresolved level:error'},
        },
      },
    });

    expect(result.current).toBe('level:error');
    await waitFor(() => expect(mockTagsRequest).toHaveBeenCalledTimes(1));
  });
});
