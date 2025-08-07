import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';

import RelocationCreate from 'admin/views/relocationCreate';

jest.mock('sentry/actionCreators/indicator');

describe('Relocation Create', function () {
  beforeEach(function () {
    ConfigStore.set('regions', [
      {
        name: 'test',
        url: 'https://example.com/api/0/',
      },
    ]);
  });

  it('renders', async function () {
    render(<RelocationCreate />);
    expect(await screen.findByRole('heading', {name: 'Relocation'})).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('Upload relocation file data')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('List of Organization Slugs')).toBeInTheDocument();
  });

  it('accepts a file upload', async function () {
    render(<RelocationCreate />);
    const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
    const input = screen.getByLabelText('file-upload');
    await userEvent.upload(input, relocationFile);
    expect(screen.getByText('hello.tar ✓')).toBeInTheDocument();
  });

  it('rejects png file upload', async function () {
    render(<RelocationCreate />);
    const relocationFile = new File(['hello'], 'hello.png', {type: 'file'});
    const input = screen.getByLabelText('file-upload');
    // Force file to be uploaded and ignore accept attribute
    await userEvent.upload(input, relocationFile, {applyAccept: false});
    expect(addErrorMessage).toHaveBeenCalledWith('That is not a supported file type.');
  });

  it('rejects large file upload', async function () {
    render(<RelocationCreate />);
    const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
    Object.defineProperty(relocationFile, 'size', {value: 200e6 + 1});
    const input = screen.getByLabelText('file-upload');
    await userEvent.upload(input, relocationFile);
    expect(addErrorMessage).toHaveBeenCalledWith(
      'Please upload a file less than 200 MB.'
    );
  });

  it('throws error if owner is missing when form is submitted', async function () {
    render(<RelocationCreate />);
    const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
    const fileInput = screen.getByLabelText('file-upload');
    const orgsInput = screen.getByLabelText('orgs-input');
    await userEvent.upload(fileInput, relocationFile);
    await userEvent.type(orgsInput, 'testorg');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    expect(addErrorMessage).toHaveBeenCalledWith(
      'Requires relocation file, organization slug(s), and owner.'
    );
  });

  it('throws error if org slugs are missing when form is submitted', async function () {
    render(<RelocationCreate />);
    const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
    const fileInput = screen.getByLabelText('file-upload');
    const ownerInput = screen.getByLabelText('owner-input');
    await userEvent.upload(fileInput, relocationFile);
    await userEvent.type(ownerInput, 'testowner');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    expect(addErrorMessage).toHaveBeenCalledWith(
      'Requires relocation file, organization slug(s), and owner.'
    );
  });

  it('throws error if file is missing when form is submitted', async function () {
    render(<RelocationCreate />);
    const ownerInput = screen.getByLabelText('owner-input');
    const orgsInput = screen.getByLabelText('orgs-input');
    await userEvent.type(orgsInput, 'testorg');
    await userEvent.type(ownerInput, 'testowner');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    expect(addErrorMessage).toHaveBeenCalledWith(
      'Requires relocation file, organization slug(s), and owner.'
    );
  });

  it('should submit form if data is correct', async function () {
    const mockapi = MockApiClient.addMockResponse({
      url: `/relocations/`,
      method: 'POST',
      body: {
        dateAdded: '2023-12-18T01:02:03:45.678Z',
        dateUpdated: '2023-12-18T02:02:03:45.678Z',
        uuid: 'd39f84fc-554a-4d7d-95b7-78f983bcba73',
        creator: {
          email: 'alice@example.com',
          id: '2',
          username: 'alice',
        },
        owner: {
          email: 'alice@example.com',
          id: '2',
          username: 'alice',
        },
        status: 'FAILURE',
        step: 'IMPORTING',
        provenance: 'SELF_HOSTED',
        failureReason: 'A failure reason',
        scheduledPauseAtStep: null,
        scheduledCancelAtStep: null,
        wantOrgSlugs: ['foo'],
        wantUsernames: ['alice', 'david'],
      },
    });

    const {router} = render(<RelocationCreate />);
    const relocationFile = new File(['hello'], 'hello.tar', {type: 'file'});
    const fileInput = screen.getByLabelText('file-upload');
    const ownerInput = screen.getByLabelText('owner-input');
    const orgsInput = screen.getByLabelText('orgs-input');
    await userEvent.upload(fileInput, relocationFile);
    await userEvent.type(orgsInput, 'testsentry, testgetsentry');
    await userEvent.type(ownerInput, 'testowner');
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    await waitFor(() => expect(mockapi).toHaveBeenCalled());
    expect(mockapi).toHaveBeenCalled();
    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: `/_admin/relocations/test/d39f84fc-554a-4d7d-95b7-78f983bcba73/`,
      })
    );
  });
});
