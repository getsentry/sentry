import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicatorActions from 'sentry/actionCreators/indicator';
import Indicators from 'sentry/components/indicators';
import * as RegionUtils from 'sentry/utils/regions';
import OrganizationSettingsForm from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/utils/regions');

describe('OrganizationSettingsForm', function () {
  const {organization, routerProps} = initializeOrg();
  let putMock: jest.Mock;
  const onSave = jest.fn();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?provider_key=github`,
      method: 'GET',
      body: {
        providers: [{canAdd: true}],
      },
    });
    onSave.mockReset();
  });

  it('can change a form field', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture()}
        onSave={onSave}
      />
    );

    render(<Indicators />);

    const input = screen.getByRole('textbox', {name: 'Display Name'});

    const saveOnBlur = jest.spyOn(indicatorActions, 'saveOnBlurUndoMessage');

    await userEvent.clear(input);
    await userEvent.type(input, 'New Name');
    await userEvent.tab();

    expect(putMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          name: 'New Name',
        },
      })
    );

    expect(saveOnBlur).toHaveBeenCalledWith(
      {
        new: 'New Name',
        old: 'Organization Name',
      },
      expect.anything(),
      'name'
    );

    const model = saveOnBlur.mock.calls[0]![1];

    // Test "undo" call undo directly
    expect(model.getValue('name')).toBe('New Name');
    act(() => {
      model.undo();
    });
    expect(model.getValue('name')).toBe('Organization Name');

    // `saveOnBlurUndoMessage` saves the new field, so reimplement this
    act(() => {
      model.saveField('name', 'Organization Name');
    });

    // Initial data should be updated to original name
    await waitFor(() => expect(model.initialData.name).toBe('Organization Name'));

    putMock.mockReset();

    // Blurring the name field again should NOT trigger a save
    await userEvent.click(input);
    await userEvent.tab();

    expect(putMock).not.toHaveBeenCalled();
  });

  it('can change slug', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture()}
        onSave={onSave}
      />
    );

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});

    await userEvent.clear(input);
    await userEvent.type(input, 'NEW SLUG');
    await userEvent.tab();

    expect(putMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(putMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );
  });

  it('can enable codecov', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, codecovAccess: true},
    });

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({codecovAccess: false})}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['codecov-integration'],
        },
      }
    );

    await userEvent.click(
      screen.getByRole('checkbox', {name: /Enable Code Coverage Insights/})
    );

    expect(putMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        data: {
          codecovAccess: true,
        },
      })
    );
  });

  it('can toggle hideAiFeatures setting', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, hideAiFeatures: true},
    });

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({hideAiFeatures: false})}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['autofix'],
        },
      }
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Hide AI Features'}));

    expect(putMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        data: {
          hideAiFeatures: true,
        },
      })
    );
  });

  it('disables hideAiFeatures toggle and shows tooltip for DE region', function () {
    // Mock the region util to return DE region
    jest.mocked(RegionUtils.getRegionDataFromOrganization).mockImplementation(() => ({
      name: 'de',
      displayName: 'Europe (Frankfurt)',
      url: 'https://sentry.de.example.com',
    }));

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture()}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['autofix'],
        },
      }
    );

    const toggle = screen.getByRole('checkbox', {name: 'Hide AI Features'});
    expect(toggle).toBeDisabled();
  });
});
