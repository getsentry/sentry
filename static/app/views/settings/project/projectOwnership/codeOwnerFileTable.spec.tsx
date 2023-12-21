import {CodeOwner as CodeOwnerFixture} from 'sentry-fixture/codeOwner';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CodeOwnerFileTable} from './codeOwnerFileTable';

describe('CodeOwnerFileTable', () => {
  const organization = Organization();
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
      date_updated: new Date('2023-10-03'),
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
});
