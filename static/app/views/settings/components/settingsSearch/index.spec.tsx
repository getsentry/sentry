import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationsFixture} from 'sentry-fixture/organizations';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {navigateTo} from 'sentry/actionCreators/navigation';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import SettingsSearch from 'sentry/views/settings/components/settingsSearch';

jest.mock('sentry/actionCreators/navigation');

// Mock the formSource module to avoid require.context which isn't available in Jest
jest.mock('sentry/components/search/sources/formSource', () => {
  const actual = jest.requireActual('sentry/components/search/sources/formSource');
  return {
    ...actual,
    __esModule: true,
    default: function FormSource({children}: any) {
      return children({
        isLoading: false,
        results: [
          {
            item: {
              title: 'test-1',
              description: 'Test field 1',
              sourceType: 'field',
              resultType: 'field',
              to: '/test-1/',
            },
            refIndex: 0,
            score: 1,
          },
        ],
      });
    },
  };
});

describe('SettingsSearch', () => {
  beforeEach(() => {
    // Use a different name and slug for organization to avoid conflicts with form search results
    OrganizationsStore.load([
      ...OrganizationsFixture().map(org => ({
        ...org,
        name: 'My Organization',
        slug: 'my-org',
      })),
    ]);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'foo-project'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [TeamFixture({slug: 'foo-team'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: MembersFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/?plugins=_all',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/configs/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/sentry-apps/?status=published',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/doc-integrations/',
      body: [],
    });
  });

  it('renders', () => {
    render(<SettingsSearch />);

    // renders input
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('can focus when hotkey is pressed', () => {
    render(<SettingsSearch />);
    fireEvent.keyDown(document.body, {key: 'Slash', code: 'Slash', keyCode: 191});
    expect(screen.getByPlaceholderText('Search')).toHaveFocus();
  });

  it('can search', async () => {
    render(<SettingsSearch />);

    await userEvent.type(screen.getByPlaceholderText('Search'), 'test');
    await userEvent.click(await screen.findByText(textWithMarkupMatcher('test-1')));

    expect(navigateTo).toHaveBeenCalledWith('/test-1/', expect.anything(), undefined);
  });
});
