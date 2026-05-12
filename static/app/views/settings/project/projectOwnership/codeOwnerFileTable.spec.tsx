import {CodeOwnerFixture} from 'sentry-fixture/codeOwner';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CodeOwnerFileTable} from './codeOwnerFileTable';

describe('CodeOwnerFileTable', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const codeowner = CodeOwnerFixture();

  it('renders empty', () => {
    const {container} = render(
      <CodeOwnerFileTable
        project={project}
        codeowners={[]}
        onDelete={() => {}}
        onUpdate={() => {}}
        disabled={false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders table w/ sync & delete actions', async () => {
    const newCodeowner = {
      ...codeowner,
      raw: '# new codeowner rules',
    };
    const codeOwnerSyncData = {
      ...codeowner,
      raw: '# new codeowner rules',
    };
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/code-mappings/${codeowner.codeMappingId}/codeowners/`,
      body: newCodeowner,
    });
    MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`,
      body: codeOwnerSyncData,
    });

    MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`,
      body: {},
    });

    const onDelete = jest.fn();
    const onUpdate = jest.fn();
    render(
      <CodeOwnerFileTable
        project={project}
        codeowners={[codeowner]}
        onDelete={onDelete}
        onUpdate={onUpdate}
        disabled={false}
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('example/repo-name')).toBeInTheDocument();
    const datetime = screen.getByRole('time').getAttribute('datetime')!;
    expect(new Date(datetime).getTime()).toBe(new Date(codeowner.dateSynced!).getTime());

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Sync'}));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(codeOwnerSyncData);
    });

    await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(codeowner);
    });
  });

  it('falls back to dateUpdated when dateSynced is null', () => {
    const codeownerWithoutSync = {...codeowner, dateSynced: null};
    render(
      <CodeOwnerFileTable
        project={project}
        codeowners={[codeownerWithoutSync]}
        onDelete={() => {}}
        onUpdate={() => {}}
        disabled={false}
      />,
      {organization}
    );

    const datetime = screen.getByRole('time').getAttribute('datetime')!;
    expect(new Date(datetime).getTime()).toBe(new Date(codeowner.dateUpdated).getTime());
  });
});
