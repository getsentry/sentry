// import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import Relocations from 'admin/views/relocations';

jest.mock('sentry/actionCreators/indicator');

describe('Relocations', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/relocations/',
      method: 'GET',
      body: [
        {
          dateAdded: '2023-12-18T01:02:03:45.678Z',
          dateUpdated: '2023-12-18T02:02:03:45.678Z',
          uuid: 'd39f84fc-554a-4d7d-95b7-78f983bcba73',
          creator: {
            email: 'alice@example.com',
            id: '2',
            username: 'alice@example.com',
          },
          owner: {
            email: 'alice@example.com',
            id: '2',
            username: 'alice@example.com',
          },
          status: 'FAILURE',
          step: 'IMPORTING',
          failureReason: 'A failure reason',
          scheduledPauseAtStep: null,
          scheduledCancelAtStep: null,
          provenance: 'SELF_HOSTED',
          wantOrgSlugs: ['foo'],
          wantUsernames: ['alice', 'david'],
        },
        {
          dateAdded: '2023-12-18T03:02:03:45.678Z',
          dateUpdated: '2023-12-18T04:02:03:45.678Z',
          uuid: '008e5820-31bd-45d5-83df-3a8c8b971ebc',
          creator: {
            email: 'admin@example.com',
            id: '1',
            username: 'admin@example.com',
          },
          owner: {
            email: 'alice@example.com',
            id: '2',
            username: 'alice@example.com',
          },
          status: 'SUCCESS',
          step: 'COMPLETED',
          failureReason: null,
          scheduledPauseAtStep: null,
          scheduledCancelAtStep: null,
          provenance: 'SELF_HOSTED',
          wantOrgSlugs: ['bar'],
          wantUsernames: ['alice'],
        },
        {
          dateAdded: '2023-12-18T05:02:03:45.678Z',
          dateUpdated: '2023-12-18T06:02:03:45.678Z',
          uuid: '589376f2-ab6a-4476-abed-81f0a26446d6',
          creator: {
            email: 'admin@example.com',
            id: '1',
            username: 'admin@example.com',
          },
          owner: {
            email: 'bob@example.com',
            id: '3',
            username: 'bob@example.com',
          },
          status: 'PAUSE',
          step: 'POSTPROCESSING',
          failureReason: null,
          scheduledPauseAtStep: null,
          scheduledCancelAtStep: null,
          provenance: 'SAAS_TO_SAAS',
          wantOrgSlugs: ['bar'],
          wantUsernames: ['david'],
        },
        {
          dateAdded: '2023-12-18T07:02:03:45.678Z',
          dateUpdated: '2023-12-18T08:02:03:45.678Z',
          uuid: '9f14e990-dd8d-4f45-b759-a8982692e530',
          creator: {
            email: 'admin@example.com',
            id: '1',
            username: 'admin@example.com',
          },
          owner: {
            email: 'claire@example.com',
            id: '4',
            username: 'claire@example.com',
          },
          status: 'IN_PROGRESS',
          step: 'PREPROCESSING',
          provenance: 'SAAS_TO_SAAS',
          failureReason: null,
          scheduledPauseAtStep: 'VALIDATING',
          scheduledCancelAtStep: null,
          wantOrgSlugs: ['qux'],
          wantUsernames: ['claire', 'david'],
          latestNotified: null,
          latestUnclaimedEmailsSentAt: null,
        },
        {
          dateAdded: '2023-12-18T07:02:03:45.678Z',
          dateUpdated: '2023-12-18T08:02:03:45.678Z',
          uuid: '3fbb1244-6bbf-4501-8408-b937fde59705',
          creator: {
            email: 'david@example.com',
            id: '5',
            username: 'david@example.com',
          },
          owner: {
            email: 'claire@example.com',
            id: '4',
            username: 'claire@example.com',
          },
          status: 'IN_PROGRESS',
          step: 'UPLOADING',
          failureReason: null,
          scheduledPauseAtStep: 'NOTIFYING',
          scheduledCancelAtStep: 'PREPROCESSING',
          provenance: 'SAAS_TO_SAAS',
          wantOrgSlugs: ['qux'],
          wantUsernames: ['david'],
          latestNotified: null,
          latestUnclaimedEmailsSentAt: null,
        },
      ],
    });
  });

  it('renders', async () => {
    render(<Relocations />);

    expect(await screen.findByRole('heading', {name: 'Relocations'})).toBeInTheDocument();

    // UUIDs
    expect(screen.getByText('d39f84fc-554a-4d7d-95b7-78f983bcba73')).toBeInTheDocument();
    expect(screen.getByText('008e5820-31bd-45d5-83df-3a8c8b971ebc')).toBeInTheDocument();
    expect(screen.getByText('589376f2-ab6a-4476-abed-81f0a26446d6')).toBeInTheDocument();
    expect(screen.getByText('9f14e990-dd8d-4f45-b759-a8982692e530')).toBeInTheDocument();
    expect(screen.getByText('3fbb1244-6bbf-4501-8408-b937fde59705')).toBeInTheDocument();

    // Users
    expect(screen.getAllByText('admin@example.com')).toHaveLength(3);
    expect(screen.getAllByText('alice@example.com')).toHaveLength(3);
    expect(screen.getAllByText('bob@example.com')).toHaveLength(1);
    expect(screen.getAllByText('claire@example.com')).toHaveLength(2);
    expect(screen.getAllByText('david@example.com')).toHaveLength(1);

    // Statuses
    expect(screen.getAllByText('Failed')).toHaveLength(1);
    expect(screen.getAllByText('Succeeded')).toHaveLength(1);
    expect(screen.getAllByText('Paused')).toHaveLength(1);
    expect(screen.getAllByText('Working')).toHaveLength(1);
    expect(screen.getAllByText('Cancelling')).toHaveLength(1);

    // Steps
    expect(screen.getAllByText('Uploading')).toHaveLength(1);
    expect(screen.getAllByText('Preprocessing')).toHaveLength(1);
    expect(screen.getAllByText('Validating')).toHaveLength(1);
    expect(screen.getAllByText('Importing')).toHaveLength(1);
    expect(screen.getAllByText('Postprocessing')).toHaveLength(1);
    expect(screen.getAllByText('Notifying')).toHaveLength(1);
    expect(screen.getAllByText('Completed')).toHaveLength(1);
  });
});
