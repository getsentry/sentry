import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import * as RegionUtils from 'sentry/utils/regions';
import OrganizationSettingsForm from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

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

    expect(checkbox).toBeChecked();
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

    expect(checkbox).not.toBeChecked();
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

  describe('AI Code Review field', () => {
    it('renders AI Code Review field', () => {
      render(
        <OrganizationSettingsForm
          initialData={OrganizationFixture({hideAiFeatures: true})}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            features: ['gen-ai-features', 'code-review-beta'],
          },
        }
      );

      expect(screen.getByText('Enable AI Code Review')).toBeInTheDocument();

      expect(screen.getByText('beta')).toBeInTheDocument();

      expect(
        screen.getByText('Use AI to review and find bugs in pull requests')
      ).toBeInTheDocument();

      const learnMoreLinks = screen.getAllByRole('link', {name: 'Learn more'});
      const aiCodeReviewLink = learnMoreLinks.find(
        link =>
          link.getAttribute('href') ===
          'https://docs.sentry.io/product/ai-in-sentry/ai-code-review/'
      );
      expect(aiCodeReviewLink).toBeInTheDocument();
    });

    it('hides AI Code Review field when AI features are disabled', () => {
      render(
        <OrganizationSettingsForm
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

      expect(screen.queryByText('Enable AI Code Review')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Use AI to review and find bugs in pull requests')
      ).not.toBeInTheDocument();
    });

    it('shows PR Review and Test Generation field when AI features are enabled', () => {
      render(
        <OrganizationSettingsForm
          initialData={OrganizationFixture({hideAiFeatures: true})}
          onSave={onSave}
        />,
        {
          organization: {
            ...organization,
            features: ['gen-ai-features', 'code-review-beta'],
          },
        }
      );

      expect(screen.getByText('Enable AI Code Review')).toBeInTheDocument();
      expect(
        screen.getByText('Use AI to review and find bugs in pull requests')
      ).toBeInTheDocument();
    });

    it('shows/hides PR Review field when toggling AI features', async () => {
      // The form derives aiEnabled from initialData, so we need a stateful wrapper
      // that propagates saved org updates back as initialData — mirroring index.tsx behavior.
      function TestWrapper() {
        const [initialData, setInitialData] = useState<Organization>(
          OrganizationFixture({hideAiFeatures: false})
        );
        return (
          <OrganizationSettingsForm
            initialData={initialData}
            onSave={(_, updated) => setInitialData(updated)}
          />
        );
      }

      render(<TestWrapper />, {
        organization: {
          ...organization,
          features: ['gen-ai-features', 'code-review-beta'],
        },
      });

      // Initially AI features are disabled, so PR Review field should be hidden
      expect(screen.queryByText('Enable AI Code Review')).not.toBeInTheDocument();

      // Mock: saving with AI enabled returns an org with hideAiFeatures: true (form-value: AI shown)
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture({hideAiFeatures: true}),
      });

      const aiToggle = screen.getByRole('checkbox', {
        name: 'Show Generative AI Features',
      });
      await userEvent.click(aiToggle);

      // PR Review field should now be visible
      expect(await screen.findByText('Enable AI Code Review')).toBeInTheDocument();

      // Mock: saving with AI disabled returns an org with hideAiFeatures: false (form-value: AI hidden)
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture({hideAiFeatures: false}),
      });

      await userEvent.click(aiToggle);

      // PR Review field should be hidden again
      await waitFor(() => {
        expect(screen.queryByText('Enable AI Code Review')).not.toBeInTheDocument();
      });
    });

    describe('region and access behavior', () => {
      it('is enabled when US region', () => {
        jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
          name: 'us',
          displayName: 'United States of America (US)',
          url: 'https://sentry.example.com',
        });

        render(
          <OrganizationSettingsForm
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

        const preventAiField = screen.getByRole('checkbox', {
          name: /Enable AI Code Review/i,
        });
        expect(preventAiField).toBeInTheDocument();
        expect(preventAiField).toBeEnabled();
        expect(screen.queryByTestId('prevent-ai-disabled-tag')).not.toBeInTheDocument();
      });

      it('is visible when seer-added or code-review-beta feature flag is on', () => {
        jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
          name: 'us',
          displayName: 'United States of America (US)',
          url: 'https://sentry.example.com',
        });

        render(
          <OrganizationSettingsForm
            initialData={OrganizationFixture({hideAiFeatures: true})}
            onSave={onSave}
          />,
          {
            organization: {
              ...organization,
              features: ['gen-ai-features', 'seer-added', 'code-review-beta'],
            },
          }
        );

        expect(
          screen.getByRole('checkbox', {
            name: /Enable AI Code Review/i,
          })
        ).toBeInTheDocument();
      });

      it('is enabled when EU region', () => {
        jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
          name: 'de',
          displayName: 'Europe (Frankfurt)',
          url: 'https://sentry.de.example.com',
        });

        render(
          <OrganizationSettingsForm
            initialData={OrganizationFixture({hideAiFeatures: true})}
            onSave={onSave}
          />,
          {
            organization: {
              ...organization,
              features: ['gen-ai-features', 'seer-added'],
            },
          }
        );

        const preventAiField = screen.getByRole('checkbox', {
          name: /Enable AI Code Review/i,
        });
        expect(preventAiField).toBeInTheDocument();
        expect(preventAiField).toBeEnabled();
        expect(screen.queryByTestId('prevent-ai-disabled-tag')).not.toBeInTheDocument();
      });

      it('is enabled when user is an admin (has org:write access)', () => {
        jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
          name: 'us',
          displayName: 'United States of America (US)',
          url: 'https://sentry.example.com',
        });

        render(
          <OrganizationSettingsForm
            initialData={OrganizationFixture({
              hideAiFeatures: true,
            })}
            onSave={onSave}
          />,
          {
            organization: {
              ...organization,
              access: ['org:write'],
              features: ['gen-ai-features', 'seer-added'],
            },
          }
        );

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
            initialData={OrganizationFixture({
              hideAiFeatures: true,
            })}
            onSave={onSave}
          />,
          {
            organization: {
              ...organization,
              access: ['org:read'],
              features: ['gen-ai-features', 'seer-added'],
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
            initialData={OrganizationFixture({
              hideAiFeatures: true,
            })}
            onSave={onSave}
          />,
          {
            organization: {
              ...organization,
              access: ['org:write'],
              features: ['gen-ai-features', 'seer-added'],
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
          await screen.findByText(
            'This feature is not available for self-hosted instances'
          )
        ).toBeInTheDocument();
      });

      it('is hidden when seat-based-seer-enabled feature is on', () => {
        jest.mocked(RegionUtils.getRegionDataFromOrganization).mockReturnValue({
          name: 'us',
          displayName: 'United States of America (US)',
          url: 'https://sentry.example.com',
        });

        render(
          <OrganizationSettingsForm
            initialData={OrganizationFixture({hideAiFeatures: true})}
            onSave={onSave}
          />,
          {
            organization: {
              ...organization,
              features: ['gen-ai-features', 'seer-added', 'seat-based-seer-enabled'],
            },
          }
        );

        expect(
          screen.queryByRole('checkbox', {
            name: /Enable AI Code Review/i,
          })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Replay access', () => {
    it('does not render restrict replay access toggle if org does not have granular-replay-permissions', () => {
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />
      );
      expect(
        screen.queryByRole('checkbox', {name: 'Restrict Replay Access'})
      ).not.toBeInTheDocument();
    });

    it('renders restrict replay access toggle if org has granular-replay-permissions', () => {
      render(
        <OrganizationSettingsForm initialData={OrganizationFixture()} onSave={onSave} />,
        {organization: {...organization, features: ['granular-replay-permissions']}}
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
            features: ['granular-replay-permissions'],
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
            features: ['granular-replay-permissions'],
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
            features: ['granular-replay-permissions'],
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
            features: ['granular-replay-permissions'],
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
            features: ['granular-replay-permissions'],
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
            features: ['granular-replay-permissions'],
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
