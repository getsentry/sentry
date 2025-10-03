import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {EventSearch} from 'sentry/views/issueDetails/streamline/eventSearch';

const mockHandleSearch = jest.fn();

describe('EventSearch', () => {
  const organization = OrganizationFixture({
    features: ['search-query-builder-input-flow-changes'],
  });
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

  it('handles basic inputs for tags', async () => {
    render(<EventSearch {...defaultProps} />, {organization});
    const search = screen.getByRole('combobox', {name: 'Add a search term'});
    expect(search).toBeInTheDocument();
    await userEvent.type(search, `${tagKey}:`);
    await userEvent.click(screen.getByRole('option', {name: 'is'}));
    await userEvent.keyboard(`${tagValue}{enter}{enter}`);

    await waitFor(() => {
      expect(mockTagKeyQuery).toHaveBeenCalled();
    });
    expect(mockHandleSearch).toHaveBeenCalledWith(
      `${tagKey}:${tagValue}`,
      expect.anything()
    );
  }, 10_000);
});
