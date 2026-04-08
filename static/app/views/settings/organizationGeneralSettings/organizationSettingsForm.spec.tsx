import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {MemberListStore} from 'sentry/stores/memberListStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import * as RegionUtils from 'sentry/utils/regions';
import {OrganizationSettingsForm} from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

jest.mock('sentry/utils/regions');

describe('OrganizationSettingsForm', () => {
  const organization = OrganizationFixture();
  let putMock: jest.Mock;
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    onSave.mockReset();
  });

  it('can change a form field', async () => {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, name: 'New Name'},
    });

    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />
    );

    const input = screen.getByRole('textbox', {name: 'Display Name'});

    await userEvent.clear(input);
    await userEvent.type(input, 'New Name');
    await userEvent.tab();

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            name: 'New Name',
          },
        })
      );
    });
  });

  it('hides slug alert and save/cancel until slug is modified', async () => {
    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />
    );

    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Learn more'})).not.toBeInTheDocument();

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});
    await userEvent.type(input, '-changed');

    expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Learn more'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
  });

  it('can change slug', async () => {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />
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

  it('hides Save/Cancel after successful slug change', async () => {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, slug: 'new-slug'},
    });

    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />
    );

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});
    await userEvent.clear(input);
    await userEvent.type(input, 'new-slug');

    expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalled();
    });

    // After successful save, form.reset() syncs defaults so the form is pristine again
    await waitFor(() => {
      expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
  });

  it('shows field error when slug is already taken', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      statusCode: 400,
      body: {slug: ['The slug "taken" is in use by another organization.']},
    });

    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />
    );

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});
    await userEvent.clear(input);
    await userEvent.type(input, 'taken');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('The slug "taken" is in use by another organization.')
    ).toBeInTheDocument();
  });

  it('can enable codecov', async () => {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, codecovAccess: true},
    });

    render(
      <OrganizationSettingsForm
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

  it('can enable "Show Generative AI Features"', async () => {
    // initialData.hideAiFeatures = false (default) → switch starts OFF
    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
      {organization: {...organization, features: ['gen-ai-features']}}
    );
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Show Generative AI Features',
    });

    expect(checkbox).not.toBeChecked();

    // Click to enable: form value → true, API receives hideAiFeatures: !true = false
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: {hideAiFeatures: false},
        })
      );
    });
  });

  it('can disable "Show Generative AI Features"', async () => {
    // initialData.hideAiFeatures = true → switch starts ON
    render(
      <OrganizationSettingsForm
        initialData={OrganizationFixture({hideAiFeatures: true})}
        onSave={onSave}
      />,
      {organization: {...organization, features: ['gen-ai-features']}}
    );
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    const checkbox = screen.getByRole('checkbox', {
      name: 'Show Generative AI Features',
    });

    expect(checkbox).toBeChecked();

    // Click to disable: form value → false, API receives hideAiFeatures: !false = true
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {hideAiFeatures: true}})
      );
    });
  });

  it('shows hideAiFeatures toggle for DE region', () => {
    // Mock the region util to return DE region
    jest.mocked(RegionUtils.getRegionDataFromOrganization).mockImplementation(() => ({
      name: 'de',
      displayName: 'Europe (Frankfurt)',
      url: 'https://sentry.de.example.com',
    }));

    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
      {
        organization: {
          ...organization,
          features: ['autofix', 'gen-ai-features'],
        },
      }
    );

    const toggle = screen.getByRole('checkbox', {name: 'Show Generative AI Features'});
    expect(toggle).toBeEnabled();
  });

  it('disables "Show Generative AI Features" toggle when feature flag is off', () => {
    render(
      <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
      {
        organization: {
          ...organization,
          features: [], // No gen-ai-features flag
        },
      }
    );

    const checkbox = screen.getByRole('checkbox', {
      name: 'Show Generative AI Features',
    });

    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
  });

  describe('Replay access', () => {
    it('renders restrict replay access toggle', () => {
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />
      );
      expect(
        screen.getByRole('checkbox', {name: 'Restrict Replay Access'})
      ).toBeInTheDocument();
    });

    it('does not render replay access members field when hasGranularReplayPermissions is false', () => {
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
        {
          organization: {
            ...organization,

            hasGranularReplayPermissions: false,
          },
        }
      );
      expect(
        screen.getByRole('checkbox', {name: 'Restrict Replay Access'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', {name: 'Replay Access Members'})
      ).not.toBeInTheDocument();
    });

    it('renders replay access members field when hasGranularReplayPermissions is true', () => {
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
        {
          organization: {
            ...organization,

            hasGranularReplayPermissions: true,
          },
        }
      );
      expect(
        screen.getByRole('textbox', {name: 'Replay Access Members'})
      ).toBeInTheDocument();
    });

    it('disables replay access members field if user does not have org:write access', () => {
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
        {
          organization: {
            ...organization,
            access: [],

            hasGranularReplayPermissions: true,
          },
        }
      );
      expect(screen.getByRole('textbox', {name: 'Replay Access Members'})).toBeDisabled();
    });

    it('saves when Restrict Replay Access toggle is enabled', async () => {
      const replayPutMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: {...organization, hasGranularReplayPermissions: true},
      });
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
        {
          organization: {
            ...organization,

            hasGranularReplayPermissions: false,
          },
        }
      );

      await userEvent.click(
        screen.getByRole('checkbox', {name: 'Restrict Replay Access'})
      );

      await waitFor(() => {
        expect(replayPutMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/`,
          expect.objectContaining({data: {hasGranularReplayPermissions: true}})
        );
      });
    });

    it('shows confirmation and saves when Restrict Replay Access toggle is disabled', async () => {
      renderGlobalModal();
      const replayPutMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: {...organization, hasGranularReplayPermissions: false},
      });
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
        {
          organization: {
            ...organization,

            hasGranularReplayPermissions: true,
          },
        }
      );

      await userEvent.click(
        screen.getByRole('checkbox', {name: 'Restrict Replay Access'})
      );

      await screen.findByText(
        'This will allow all members of your organization to access replay data. Do you want to continue?'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(replayPutMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/`,
          expect.objectContaining({data: {hasGranularReplayPermissions: false}})
        );
      });
    });

    it('saves replayAccessMembers when a member is selected', async () => {
      MemberListStore.loadInitialData([UserFixture()]);
      const replayPutMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: {...organization, replayAccessMembers: [1]},
      });
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
        {
          organization: {
            ...organization,

            hasGranularReplayPermissions: true,
          },
        }
      );

      await userEvent.click(screen.getByRole('textbox', {name: 'Replay Access Members'}));
      await userEvent.click(
        await screen.findByRole('menuitemcheckbox', {name: 'Foo Bar'})
      );
      await userEvent.keyboard('{Escape}');
      await userEvent.tab();

      await waitFor(() => {
        expect(replayPutMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/`,
          expect.objectContaining({data: {replayAccessMembers: [1]}})
        );
      });
    });
  });
});
