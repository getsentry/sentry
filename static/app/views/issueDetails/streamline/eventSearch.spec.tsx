import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {
  makeAllTheProviders,
  render,
  renderHook,
  screen,
  userEvent,
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
  const [tagKey, tagValue] = ['user.email', 'leander.rodrigues@sentry.io'];
  let mockTagKeyQuery: jest.Mock;

  beforeEach(() => {
    OrganizationStore.onUpdate(organization, {replace: true});
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
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

  it('handles basic inputs for tags', async function () {
    render(<EventSearch {...defaultProps} />);
    const search = screen.getByRole('combobox', {name: 'Add a search term'});
    expect(search).toBeInTheDocument();
    await userEvent.type(search, `${tagKey}:`);
    await userEvent.keyboard(`${tagValue}{enter}{enter}`);

    expect(mockTagKeyQuery).toHaveBeenCalled();
    expect(mockHandleSearch).toHaveBeenCalledWith(
      `${tagKey}:${tagValue}`,
      expect.anything()
    );
  });

  it('filters issue tokens from event queries', function () {
    const validQuery = `${tagKey}:${tagValue} device.family:[iphone,pixel]`;

    const {result: onlyIssueTokens} = renderHook(
      () => useEventQuery({groupId: group.id}),
      {
        wrapper: makeAllTheProviders({
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {query: 'is:resolved assigned:[me,#issues] issue.priority:high'},
            }),
          }),
        }),
      }
    );
    expect(onlyIssueTokens.current).toBe('');

    const {result: combinedTokens} = renderHook(
      () => useEventQuery({groupId: group.id}),
      {
        wrapper: makeAllTheProviders({
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {query: `is:resolved assigned:[me,#issues] ${validQuery}`},
            }),
          }),
        }),
      }
    );
    expect(combinedTokens.current).toBe(validQuery);

    const {result: onlyEventTokens} = renderHook(
      () => useEventQuery({groupId: group.id}),
      {
        wrapper: makeAllTheProviders({
          organization,
          router: RouterFixture({
            location: LocationFixture({
              query: {query: validQuery},
            }),
          }),
        }),
      }
    );
    expect(onlyEventTokens.current).toBe(validQuery);

    const {result: unrecognizedFilterKey} = renderHook(
      () => useEventQuery({groupId: group.id}),
      {
        wrapper: makeAllTheProviders({
          organization,
          router: RouterFixture({
            location: LocationFixture({
              // This isn't in the TagsFixture or ISSUE_EVENT_PROPERTY_FIELDS
              query: {query: `${validQuery} organization.slug:sentry`},
            }),
          }),
        }),
      }
    );
    expect(unrecognizedFilterKey.current).toBe(validQuery);
  });
});
