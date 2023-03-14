import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CodeOwnerFileTable} from './codeOwnerFileTable';

describe('CodeOwnerFileTable', () => {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const codeowner = TestStubs.CodeOwner();

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
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/code-mappings/${codeowner.codeMappingId}/codeowners/`,
      body: newCodeowner,
    });
    MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`,
      body: newCodeowner,
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

    userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Sync'}));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(newCodeowner);
    });

    userEvent.click(screen.getByRole('button', {name: 'Actions'}));
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(codeowner);
    });
  });
});
