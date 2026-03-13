import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {type JsonFormAdapterFieldConfig} from './types';
import {BackendJsonFormAdapter} from './';

const VERCEL_PROJECTS = [
  {value: 'proj-1', label: 'my-vercel-project', url: 'https://vercel.com/proj-1'},
  {value: 'proj-2', label: 'another-project', url: 'https://vercel.com/proj-2'},
  {value: 'proj-3', label: 'third-project', url: 'https://vercel.com/proj-3'},
];

const SENTRY_PROJECTS = [
  {id: 101, slug: 'sentry-frontend', name: 'Sentry Frontend', platform: 'javascript'},
  {id: 102, slug: 'sentry-backend', name: 'Sentry Backend', platform: 'python'},
];

function makeConfig(
  overrides?: Partial<Extract<JsonFormAdapterFieldConfig, {type: 'project_mapper'}>>
): JsonFormAdapterFieldConfig {
  return {
    name: 'project_mappings',
    type: 'project_mapper',
    label: 'Vercel Projects',
    help: 'Map Vercel projects to Sentry projects',
    iconType: 'vercel',
    mappedDropdown: {
      items: VERCEL_PROJECTS,
      placeholder: 'Vercel project\u2026',
    },
    sentryProjects: SENTRY_PROJECTS,
    ...overrides,
  };
}

function renderField(fieldConfig: JsonFormAdapterFieldConfig, initialValue?: unknown) {
  const org = OrganizationFixture();
  const mutationOptions = {
    mutationFn: jest.fn().mockResolvedValue({}),
  };

  render(
    <BackendJsonFormAdapter
      field={fieldConfig}
      initialValue={initialValue}
      mutationOptions={mutationOptions}
    />,
    {organization: org}
  );

  return {mutationOptions};
}

describe('ProjectMapperAdapter', () => {
  it('renders empty state with two dropdowns and disabled Add button', () => {
    renderField(makeConfig(), []);

    expect(screen.getByText('Vercel project\u2026')).toBeInTheDocument();
    expect(screen.getByText('Sentry project\u2026')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add project'})).toBeDisabled();
    // No delete buttons when empty
    expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
  });

  it('renders existing mappings with icon, label, link, arrow, IdBadge, delete', () => {
    renderField(makeConfig(), [[101, 'proj-1']]);

    // Mapped item label
    expect(screen.getByText('my-vercel-project')).toBeInTheDocument();
    // External link present
    const links = screen.getAllByRole('link');
    expect(
      links.some(link => link.getAttribute('href') === 'https://vercel.com/proj-1')
    ).toBe(true);
    // Sentry project badge
    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
    // Delete button
    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
  });

  it('shows "Deleted" for unknown mapped items', () => {
    renderField(makeConfig(), [[101, 'unknown-value']]);

    expect(screen.getByText('Deleted')).toBeInTheDocument();
    // Sentry project should still render
    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
  });

  it('shows "Deleted" for unknown Sentry projects', () => {
    renderField(makeConfig(), [[999, 'proj-1']]);

    // Mapped item should still render
    expect(screen.getByText('my-vercel-project')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });

  it('add mapping triggers mutation', async () => {
    const {mutationOptions} = renderField(makeConfig(), []);

    // Select mapped dropdown
    await userEvent.click(screen.getByText('Vercel project\u2026'));
    await userEvent.click(await screen.findByText('my-vercel-project'));

    // Select sentry project dropdown
    await userEvent.click(screen.getByText('Sentry project\u2026'));
    await userEvent.click(await screen.findByText('sentry-frontend'));

    // Click Add
    await userEvent.click(screen.getByRole('button', {name: 'Add project'}));

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        project_mappings: [[101, 'proj-1']],
      });
    });
  });

  it('delete mapping triggers mutation', async () => {
    const {mutationOptions} = renderField(makeConfig(), [
      [101, 'proj-1'],
      [102, 'proj-2'],
    ]);

    // Delete the first mapping
    const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
    await userEvent.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalledWith({
        project_mappings: [[102, 'proj-2']],
      });
    });
  });

  it('filters already-used external items from mapped dropdown', async () => {
    renderField(makeConfig(), [[101, 'proj-1']]);

    // Open the mapped dropdown
    await userEvent.click(screen.getByText('Vercel project\u2026'));

    // proj-1 should not be available (already mapped)
    expect(
      screen.queryByRole('menuitemradio', {name: /my-vercel-project/})
    ).not.toBeInTheDocument();
    // proj-2 should still be available
    expect(
      screen.getByRole('menuitemradio', {name: /another-project/})
    ).toBeInTheDocument();
  });

  it('does not filter Sentry projects (many-to-one)', async () => {
    renderField(makeConfig(), [[101, 'proj-1']]);

    // Open the sentry project dropdown
    await userEvent.click(screen.getByText('Sentry project\u2026'));

    // Both sentry projects should be available even though 101 is already used
    expect(
      screen.getByRole('menuitemradio', {name: /sentry-frontend/})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: /sentry-backend/})
    ).toBeInTheDocument();
  });

  it('Add button disabled until both selections are made', async () => {
    renderField(makeConfig(), []);

    const addButton = screen.getByRole('button', {name: 'Add project'});
    expect(addButton).toBeDisabled();

    // Select only mapped value
    await userEvent.click(screen.getByText('Vercel project\u2026'));
    await userEvent.click(await screen.findByText('my-vercel-project'));

    // Still disabled — no sentry project selected
    expect(addButton).toBeDisabled();

    // Select sentry project
    await userEvent.click(screen.getByText('Sentry project\u2026'));
    await userEvent.click(await screen.findByText('sentry-frontend'));

    // Now enabled
    expect(addButton).toBeEnabled();
  });

  it('controls disabled during in-flight mutation', async () => {
    let resolveMutation!: () => void;
    const mutationOptions = {
      mutationFn: jest.fn(
        () => new Promise<void>(resolve => (resolveMutation = resolve))
      ),
    };

    const org = OrganizationFixture();
    render(
      <BackendJsonFormAdapter
        field={makeConfig()}
        initialValue={[
          [101, 'proj-1'],
          [102, 'proj-2'],
        ]}
        mutationOptions={mutationOptions}
      />,
      {organization: org}
    );

    // Delete buttons should be enabled initially
    const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
    expect(deleteButtons[0]).toBeEnabled();

    // Delete to trigger mutation
    await userEvent.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(mutationOptions.mutationFn).toHaveBeenCalled();
    });

    // Remaining delete button should be disabled during mutation
    expect(screen.getByRole('button', {name: 'Delete'})).toBeDisabled();

    // Resolve the mutation
    resolveMutation();

    // Controls should be re-enabled
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();
    });
  });
});
