import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {toast} from '@sentry/scraps/toast';

import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {VercelIntegrationForm} from './vercelIntegrationForm';

const org = OrganizationFixture();

const projectMappingsField = {
  name: 'project_mappings',
  type: 'project_mapper',
  mappedDropdown: {
    items: [
      {value: 'proj-1', label: 'my-vercel-project', url: 'https://vercel.com/proj-1'},
      {value: 'proj-2', label: 'another-project', url: 'https://vercel.com/proj-2'},
      {value: 'proj-3', label: 'third-project', url: 'https://vercel.com/proj-3'},
    ],
  },
  sentryProjects: [
    {id: 101, slug: 'sentry-frontend', name: 'Sentry Frontend', platform: 'javascript'},
    {id: 102, slug: 'sentry-backend', name: 'Sentry Backend', platform: null},
  ],
};

function makeIntegration(projectMappings: unknown) {
  return OrganizationIntegrationsFixture({
    configOrganization: [projectMappingsField] as unknown as JsonFormAdapterFieldConfig[],
    configData: {project_mappings: projectMappings},
  });
}

const mutationOptions = {
  mutationFn: jest.fn().mockResolvedValue({}),
};

function renderForm(
  projectMappings: unknown,
  options: {mutationFn: jest.Mock} = mutationOptions
) {
  render(
    <VercelIntegrationForm
      integration={makeIntegration(projectMappings)}
      mutationOptions={options}
    />,
    {organization: org}
  );
}

async function pickProjectsInModal() {
  await userEvent.click(screen.getByRole('button', {name: 'Link Project'}));
  const modal = await screen.findByRole('dialog');
  await selectEvent.select(
    within(modal).getByText('Choose Vercel project'),
    'my-vercel-project'
  );
  await selectEvent.select(
    within(modal).getByText('Choose Sentry project'),
    'sentry-frontend'
  );
  return modal;
}

describe('VercelIntegrationForm', () => {
  it('shows an empty state', () => {
    renderForm([]);

    expect(screen.getByText('No linked projects')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Documentation'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/organization/integrations/deployment/vercel/'
    );
    expect(screen.queryByRole('button', {name: 'Unlink'})).not.toBeInTheDocument();
  });

  it('renders linked projects', () => {
    renderForm([
      [101, 'proj-1'],
      [102, 'proj-2'],
    ]);

    expect(screen.getByText('my-vercel-project')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open my-vercel-project'})).toHaveAttribute(
      'href',
      'https://vercel.com/proj-1'
    );
    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
    expect(screen.getByText('sentry-backend')).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Unlink'})).toHaveLength(2);
    expect(screen.queryByText('No linked projects')).not.toBeInTheDocument();
  });

  it('shows "Not found" for an unknown Vercel project', () => {
    renderForm([[101, 'unknown-value']]);

    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
  });

  it('shows "Not found" for an unknown Sentry project', () => {
    renderForm([[999, 'proj-1']]);

    expect(screen.getByText('my-vercel-project')).toBeInTheDocument();
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('links a project from the modal', async () => {
    const successSpy = jest.spyOn(toast, 'success');
    renderForm([[102, 'proj-2']]);
    const {waitForModalToHide} = renderGlobalModal();

    const modal = await pickProjectsInModal();
    await userEvent.click(within(modal).getByRole('button', {name: 'Link Project'}));

    await waitForModalToHide();
    expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
      {
        project_mappings: [
          [102, 'proj-2'],
          [101, 'proj-1'],
        ],
      },
      expect.anything()
    );
    expect(successSpy).toHaveBeenCalledWith(
      'Linked my-vercel-project. Redeploy in Vercel to apply.'
    );
  });

  it('enables linking once both projects are picked', async () => {
    renderForm([]);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Link Project'}));
    const modal = await screen.findByRole('dialog');
    const submit = within(modal).getByRole('button', {name: 'Link Project'});
    expect(submit).toBeDisabled();

    await selectEvent.select(
      within(modal).getByText('Choose Vercel project'),
      'my-vercel-project'
    );
    expect(submit).toBeDisabled();

    await selectEvent.select(
      within(modal).getByText('Choose Sentry project'),
      'sentry-frontend'
    );
    expect(submit).toBeEnabled();
  });

  it('shows why a link failed in the modal and retries it', async () => {
    const error = new RequestError('POST', '/integrations/1/', new Error('Bad Request'));
    error.responseJSON = {
      project_mappings: ['You must have an enabled DSN to continue!'],
    };
    const failingMutationOptions = {
      mutationFn: jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({}),
    };
    renderForm([], failingMutationOptions);
    const {waitForModalToHide} = renderGlobalModal();

    const modal = await pickProjectsInModal();
    await userEvent.click(within(modal).getByRole('button', {name: 'Link Project'}));

    const alert = await within(modal).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't link my-vercel-project");
    expect(alert).toHaveTextContent('You must have an enabled DSN to continue!');

    await userEvent.click(within(modal).getByRole('button', {name: 'Link Project'}));

    await waitForModalToHide();
    expect(failingMutationOptions.mutationFn).toHaveBeenCalledTimes(2);
    expect(failingMutationOptions.mutationFn).toHaveBeenLastCalledWith(
      {project_mappings: [[101, 'proj-1']]},
      expect.anything()
    );
  });

  it('links to each env var that Sentry needs deleted in Vercel', async () => {
    const error = new RequestError('POST', '/integrations/1/', new Error('Bad Request'));
    error.responseJSON = {
      project_mappings: ["Sentry can't update environment variables it didn't create."],
      existing_env_vars: [
        {key: 'SENTRY_ORG', target: ['production', 'development']},
        {key: 'SENTRY_DSN', target: ['preview']},
      ],
    };
    renderForm([], {mutationFn: jest.fn().mockRejectedValue(error)});
    renderGlobalModal();

    const modal = await pickProjectsInModal();
    await userEvent.click(within(modal).getByRole('button', {name: 'Link Project'}));

    const alert = await within(modal).findByRole('alert');
    expect(alert).toHaveTextContent(
      'Delete these variables in Vercel to link my-vercel-project'
    );
    expect(alert).toHaveTextContent('SENTRY_ORGProduction and Development');
    expect(alert).toHaveTextContent('SENTRY_DSNPreview');
    expect(
      within(alert).getByRole('button', {name: 'Find SENTRY_ORG in Vercel'})
    ).toHaveAttribute(
      'href',
      'https://vercel.com/proj-1/settings/environment-variables?q=SENTRY_ORG'
    );
    expect(
      within(alert).getByRole('button', {name: 'Find SENTRY_DSN in Vercel'})
    ).toHaveAttribute(
      'href',
      'https://vercel.com/proj-1/settings/environment-variables?q=SENTRY_DSN'
    );
  });

  it('keeps the page locked when the modal closes mid-save', async () => {
    let resolveSave!: () => void;
    const pendingMutationOptions = {
      mutationFn: jest.fn(() => new Promise<void>(resolve => (resolveSave = resolve))),
    };
    renderForm([[102, 'proj-2']], pendingMutationOptions);
    const {waitForModalToHide} = renderGlobalModal();

    const modal = await pickProjectsInModal();
    await userEvent.click(within(modal).getByRole('button', {name: 'Link Project'}));
    await userEvent.click(within(modal).getByRole('button', {name: 'Cancel'}));
    await waitForModalToHide();

    expect(screen.getByRole('button', {name: 'Link Project'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Unlink'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    resolveSave();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Link Project'})).toBeEnabled();
    });
  });

  it('shows an error instead of the links when they cannot be read', () => {
    renderForm([['101', 'proj-1']]);

    expect(
      screen.getByText("Sentry couldn't read the linked Vercel projects.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Link Project'})).not.toBeInTheDocument();
  });

  it('only offers Vercel projects that are not linked yet', async () => {
    renderForm([[101, 'proj-1']]);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Link Project'}));
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByText('Choose Vercel project'));

    expect(
      screen.queryByRole('menuitemradio', {name: /my-vercel-project/})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: /another-project/})
    ).toBeInTheDocument();
  });

  it('lets a Sentry project be linked more than once', async () => {
    renderForm([[101, 'proj-1']]);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Link Project'}));
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByText('Choose Sentry project'));

    expect(
      screen.getByRole('menuitemradio', {name: /sentry-frontend/})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: /sentry-backend/})
    ).toBeInTheDocument();
  });

  it('opens project creation in a new tab', async () => {
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
    renderForm([]);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Link Project'}));
    const modal = await screen.findByRole('dialog');
    await selectEvent.select(
      within(modal).getByText('Choose Sentry project'),
      'Create a Project'
    );

    expect(openSpy).toHaveBeenCalledWith(
      `/organizations/${org.slug}/insights/projects/new/`,
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('unlinks a project after confirming', async () => {
    renderForm([
      [101, 'proj-1'],
      [102, 'proj-2'],
    ]);
    renderGlobalModal();

    await userEvent.click(screen.getAllByRole('button', {name: 'Unlink'})[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Unlink my-vercel-project?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/stop creating a release when this project deploys/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/environment variables Sentry added in Vercel stay/)
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', {name: 'Unlink'}));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith(
        {project_mappings: [[102, 'proj-2']]},
        expect.anything()
      );
    });
  });

  it('disables controls while unlinking', async () => {
    let resolveSave!: () => void;
    const pendingMutationOptions = {
      mutationFn: jest.fn(() => new Promise<void>(resolve => (resolveSave = resolve))),
    };
    renderForm(
      [
        [101, 'proj-1'],
        [102, 'proj-2'],
      ],
      pendingMutationOptions
    );
    renderGlobalModal();

    await userEvent.click(screen.getAllByRole('button', {name: 'Unlink'})[0]!);
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {name: 'Unlink'})
    );

    await waitFor(() => {
      expect(pendingMutationOptions.mutationFn).toHaveBeenCalled();
    });
    for (const button of screen.getAllByRole('button', {name: 'Unlink'})) {
      expect(button).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getByRole('button', {name: 'Link Project'})).toBeDisabled();

    resolveSave();

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Link Project'})).toBeEnabled();
    });
  });

  it('keeps a link and shows why when unlinking fails', async () => {
    const errorSpy = jest.spyOn(toast, 'error');
    renderForm([[101, 'proj-1']], {
      mutationFn: jest.fn().mockRejectedValue(new Error('nope')),
    });
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Unlink'}));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {name: 'Unlink'})
    );

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Failed to save');
    });
    expect(screen.getByText('my-vercel-project')).toBeInTheDocument();
  });

  it('labels the row buttons on hover', async () => {
    renderForm([[101, 'proj-1']]);

    await userEvent.hover(screen.getByRole('button', {name: 'Open my-vercel-project'}));
    expect(await screen.findByText('Open in Vercel')).toBeInTheDocument();
  });

  describe('complete on Vercel', () => {
    function renderWithNext(projectMappings: Array<[number, string]>, next?: string) {
      render(
        <VercelIntegrationForm
          integration={makeIntegration(projectMappings)}
          mutationOptions={mutationOptions}
        />,
        {
          organization: org,
          initialRouterConfig: {
            location: {pathname: '/', query: next ? {next} : {}},
          },
        }
      );
    }

    it('is disabled until a project is linked', () => {
      renderWithNext([], 'https://vercel.com/install/complete');

      expect(
        screen.getByText(
          'Link your Sentry projects to complete your installation on Vercel'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Complete on Vercel'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('links back to Vercel once a project is linked', () => {
      renderWithNext([[101, 'proj-1']], 'https://vercel.com/install/complete');

      const button = screen.getByRole('button', {name: 'Complete on Vercel'});
      expect(button).toHaveAttribute('href', 'https://vercel.com/install/complete');
      expect(button).toHaveAttribute('aria-disabled', 'false');
    });

    it('is hidden without a next URL', () => {
      renderWithNext([[101, 'proj-1']]);

      expect(screen.queryByText('Complete on Vercel')).not.toBeInTheDocument();
    });

    it('is hidden when the next URL is not on vercel.com', () => {
      renderWithNext([[101, 'proj-1']], 'https://vercel.com.evil.example.com/steal');

      expect(screen.queryByText('Complete on Vercel')).not.toBeInTheDocument();
    });
  });
});
