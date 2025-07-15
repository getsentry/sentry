import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as formIndicatorActions from 'sentry/components/forms/formIndicators';
import Indicators from 'sentry/components/indicators';
import * as RegionUtils from 'sentry/utils/regions';
import OrganizationSettingsForm from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

jest.mock('sentry/components/forms/formIndicators');
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

    const undoableFormChangeMessage = jest.spyOn(
      formIndicatorActions,
      'addUndoableFormChangeMessage'
    );

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

    expect(undoableFormChangeMessage).toHaveBeenCalledWith(
      {
        new: 'New Name',
        old: 'Organization Name',
      },
      expect.anything(),
      'name'
    );

    const model = undoableFormChangeMessage.mock.calls[0]![1];

    // Test "undo" call undo directly
    expect(model.getValue('name')).toBe('New Name');
    act(() => {
      model.undo();
    });
    expect(model.getValue('name')).toBe('Organization Name');

    // `addUndoableFormChangeMessage` saves the new field, so reimplement this
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

  it('can toggle "Show Generative AI Features"', async function () {
    // Default org fixture has hideAiFeatures: false, so Seer is enabled by default
    const hiddenAiOrg = OrganizationFixture({hideAiFeatures: true});
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture()}
        onSave={onSave}
      />,
      {organization: hiddenAiOrg}
    );
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Show Generative AI Features',
    });

    // Inverted from hideAiFeatures
    expect(checkbox).not.toBeChecked();

    // Click to uncheck (disable Seer -> hideAiFeatures = true)
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: {hideAiFeatures: false},
        })
      );
    });

    // Inverted from hideAiFeatures
    expect(checkbox).toBeChecked();

    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {hideAiFeatures: true}})
      );
    });
  });

  it('shows hideAiFeatures togglefor DE region', function () {
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

    const toggle = screen.getByRole('checkbox', {name: 'Show Generative AI Features'});
    expect(toggle).toBeEnabled();
  });

  it('renders PR Review and Test Generation field', function () {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture()}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Enable PR Review and Test Generation')).toBeInTheDocument();

    expect(screen.getByText('beta')).toBeInTheDocument();

    expect(
      screen.getByText('Use AI to generate feedback and tests in pull requests')
    ).toBeInTheDocument();

    const learnMoreLink = screen.getByRole('link', {name: 'Learn more'});
    expect(learnMoreLink).toBeInTheDocument();
    expect(learnMoreLink).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/'
    );
  });

  it('hides PR Review and Test Generation field when AI features are disabled', function () {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({hideAiFeatures: true})}
        onSave={onSave}
      />
    );

    expect(
      screen.queryByText('Enable PR Review and Test Generation')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Use AI to generate feedback and tests in pull requests')
    ).not.toBeInTheDocument();
  });

  it('shows PR Review and Test Generation field when AI features are enabled', function () {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({hideAiFeatures: false})}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Enable PR Review and Test Generation')).toBeInTheDocument();
    expect(
      screen.getByText('Use AI to generate feedback and tests in pull requests')
    ).toBeInTheDocument();
  });

  it('shows/hides PR Review field when toggling AI features', async function () {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({hideAiFeatures: true})}
        onSave={onSave}
      />
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    // Initially AI features are disabled, so PR Review field should be hidden
    expect(
      screen.queryByText('Enable PR Review and Test Generation')
    ).not.toBeInTheDocument();

    // Toggle AI features on (this will set hideAiFeatures to false)
    const aiToggle = screen.getByRole('checkbox', {name: 'Show Generative AI Features'});
    await userEvent.click(aiToggle);

    // PR Review field should now be visible
    expect(screen.getByText('Enable PR Review and Test Generation')).toBeInTheDocument();

    // Toggle AI features back off (this will set hideAiFeatures to true)
    await userEvent.click(aiToggle);

    // PR Review field should be hidden again
    expect(
      screen.queryByText('Enable PR Review and Test Generation')
    ).not.toBeInTheDocument();
  });
});
