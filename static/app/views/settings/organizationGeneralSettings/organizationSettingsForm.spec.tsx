import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as formIndicatorActions from 'sentry/components/forms/formIndicators';
import Indicators from 'sentry/components/indicators';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import * as RegionUtils from 'sentry/utils/regions';
import OrganizationSettingsForm from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

jest.mock('sentry/components/forms/formIndicators');
jest.mock('sentry/utils/regions');

describe('OrganizationSettingsForm', () => {
  const {organization, routerProps} = initializeOrg();
  let putMock: jest.Mock;
  let membersRequest: jest.Mock;
  const onSave = jest.fn();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationStore.onUpdate(organization, {replace: true});
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
    membersRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    onSave.mockReset();
  });

  it('can change a form field', async () => {
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

  it('can change slug', async () => {
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

  it('can enable codecov', async () => {
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

  it('can toggle "Show Generative AI Features"', async () => {
    // Default org fixture has hideAiFeatures: false, so Seer is enabled by default
    const hiddenAiOrg = OrganizationFixture({
      hideAiFeatures: true,
      features: ['gen-ai-features'],
    });
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

  it('shows hideAiFeatures togglefor DE region', async () => {
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
          features: ['autofix', 'gen-ai-features'],
        },
      }
    );

    await waitFor(() => expect(membersRequest).toHaveBeenCalled());

    const toggle = screen.getByRole('checkbox', {name: 'Show Generative AI Features'});
    expect(toggle).toBeEnabled();
  });

  it('disables "Show Generative AI Features" toggle when feature flag is off', async () => {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture()}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: [], // No gen-ai-features flag
        },
      }
    );

    await waitFor(() => expect(membersRequest).toHaveBeenCalled());

    const checkbox = screen.getByRole('checkbox', {
      name: 'Show Generative AI Features',
    });

    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
  });

  it('renders AI Code Review field', async () => {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({hideAiFeatures: true})}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['gen-ai-features'],
        },
      }
    );

    await waitFor(() => expect(membersRequest).toHaveBeenCalled());

    expect(screen.getByText('Enable AI Code Review')).toBeInTheDocument();

    expect(screen.getByText('beta')).toBeInTheDocument();

    expect(
      screen.getByText('Use AI to review and find bugs in pull requests')
    ).toBeInTheDocument();

    const learnMoreLink = screen.getByRole('link', {name: 'Learn more'});
    expect(learnMoreLink).toBeInTheDocument();
    expect(learnMoreLink).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/ai-in-sentry/ai-code-review/'
    );
  });

  it('hides AI Code Review field when AI features are disabled', async () => {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        // This logic is inverted from the variable name
        initialData={OrganizationFixture({hideAiFeatures: false})}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['gen-ai-features'],
        },
      }
    );

    await waitFor(() => expect(membersRequest).toHaveBeenCalled());

    expect(screen.queryByText('Enable AI Code Review')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Use AI to review, find bugs, and generate tests in pull requests'
      )
    ).not.toBeInTheDocument();
  });

  it('shows PR Review and Test Generation field when AI features are enabled', async () => {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({hideAiFeatures: true})}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['gen-ai-features'],
        },
      }
    );

    await waitFor(() => expect(membersRequest).toHaveBeenCalled());

    expect(screen.getByText('Enable AI Code Review')).toBeInTheDocument();
    expect(
      screen.getByText('Use AI to review and find bugs in pull requests')
    ).toBeInTheDocument();
  });

  it('shows/hides PR Review field when toggling AI features', async () => {
    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={OrganizationFixture({hideAiFeatures: false})}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['gen-ai-features'],
        },
      }
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    // Initially AI features are disabled, so PR Review field should be hidden
    expect(screen.queryByText('Enable AI Code Review')).not.toBeInTheDocument();

    const aiToggle = screen.getByRole('checkbox', {name: 'Show Generative AI Features'});
    await userEvent.click(aiToggle);

    // PR Review field should now be visible
    expect(screen.getByText('Enable AI Code Review')).toBeInTheDocument();

    await userEvent.click(aiToggle);

    // PR Review field should be hidden again
    expect(screen.queryByText('Enable AI Code Review')).not.toBeInTheDocument();
  });

  describe('AI Code Review field', () => {
    it('is enabled when US region', async () => {
      jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
        name: 'us',
        displayName: 'United States of America (US)',
        url: 'https://sentry.example.com',
      });

      render(
        <OrganizationSettingsForm
          {...routerProps}
          initialData={OrganizationFixture({hideAiFeatures: true})}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            features: ['gen-ai-features'],
          },
        }
      );

      await waitFor(() => expect(membersRequest).toHaveBeenCalled());

      const preventAiField = screen.getByRole('checkbox', {
        name: /Enable AI Code Review/i,
      });
      expect(preventAiField).toBeInTheDocument();
      expect(preventAiField).toBeEnabled();
      expect(screen.queryByTestId('prevent-ai-disabled-tag')).not.toBeInTheDocument();
    });

    it('is disabled when feature flag is off', async () => {
      jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
        name: 'us',
        displayName: 'United States of America (US)',
        url: 'https://sentry.example.com',
      });

      render(
        <OrganizationSettingsForm
          {...routerProps}
          initialData={OrganizationFixture({hideAiFeatures: true})}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            features: ['gen-ai-features'],
          },
        }
      );

      await waitFor(() => expect(membersRequest).toHaveBeenCalled());

      const preventAiField = screen.getByRole('checkbox', {
        name: /Enable AI Code Review/i,
      });
      expect(preventAiField).toBeInTheDocument();
      expect(preventAiField).toBeEnabled();

      expect(screen.queryByTestId('prevent-ai-disabled-tag')).not.toBeInTheDocument();
    });

    it('is enabled when EU region', async () => {
      jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
        name: 'de',
        displayName: 'Europe (Frankfurt)',
        url: 'https://sentry.de.example.com',
      });

      render(
        <OrganizationSettingsForm
          {...routerProps}
          initialData={OrganizationFixture({hideAiFeatures: true})}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            features: ['gen-ai-features'],
          },
        }
      );

      await waitFor(() => expect(membersRequest).toHaveBeenCalled());

      const preventAiField = screen.getByRole('checkbox', {
        name: /Enable AI Code Review/i,
      });
      expect(preventAiField).toBeInTheDocument();
      expect(preventAiField).toBeEnabled();
      expect(screen.queryByTestId('prevent-ai-disabled-tag')).not.toBeInTheDocument();
    });

    it('is enabled when user is an admin (has org:write access)', async () => {
      jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
        name: 'us',
        displayName: 'United States of America (US)',
        url: 'https://sentry.example.com',
      });

      render(
        <OrganizationSettingsForm
          {...routerProps}
          initialData={OrganizationFixture({
            hideAiFeatures: true,
          })}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            access: ['org:write'],
            features: ['gen-ai-features'],
          },
        }
      );

      await waitFor(() => expect(membersRequest).toHaveBeenCalled());

      const preventAiField = screen.getByRole('checkbox', {
        name: /Enable AI Code Review/i,
      });
      expect(preventAiField).toBeInTheDocument();
      expect(preventAiField).toBeEnabled();
      expect(screen.queryByTestId('prevent-ai-disabled-tag')).not.toBeInTheDocument();
    });

    it('is disabled when user is a member (does not have org:write access)', async () => {
      jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
        name: 'us',
        displayName: 'United States of America (US)',
        url: 'https://sentry.example.com',
      });

      render(
        <OrganizationSettingsForm
          {...routerProps}
          initialData={OrganizationFixture({
            hideAiFeatures: true,
          })}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            access: ['org:read'],
            features: ['gen-ai-features'],
          },
        }
      );

      const preventAiField = await screen.findByRole('checkbox', {
        name: /Enable AI Code Review/i,
      });
      expect(preventAiField).toBeInTheDocument();
      expect(preventAiField).toBeDisabled();
      expect(screen.queryByTestId('prevent-ai-disabled-tag')).not.toBeInTheDocument();
    });

    it('is disabled when self-hosted', async () => {
      ConfigStore.set('isSelfHosted', true);

      render(
        <OrganizationSettingsForm
          {...routerProps}
          initialData={OrganizationFixture({
            hideAiFeatures: true,
          })}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            access: ['org:write'],
            features: ['gen-ai-features'],
          },
        }
      );

      const preventAiField = screen.getByRole('checkbox', {
        name: /Enable AI Code Review/i,
      });
      expect(preventAiField).toBeInTheDocument();
      expect(preventAiField).toBeDisabled();

      // Hover over the disabled tag to show the tooltip
      const disabledTag = screen.getByTestId('prevent-ai-disabled-tag');
      expect(disabledTag).toBeInTheDocument();
      await userEvent.hover(disabledTag);
      expect(
        await screen.findByText('This feature is not available for self-hosted instances')
      ).toBeInTheDocument();
    });
  });
});
