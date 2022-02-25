import {
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {createTeam} from 'sentry/actionCreators/teams';
import CreateTeamModal from 'sentry/components/modals/createTeamModal';

jest.mock('sentry/actionCreators/teams', () => ({
  createTeam: jest.fn((...args) => new Promise(resolve => resolve(...args))),
}));

describe('CreateTeamModal', function () {
  const org = TestStubs.Organization();
  const closeModal = jest.fn();
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(function () {
    onClose.mockReset();
    onSuccess.mockReset();
  });

  it('calls createTeam action creator on submit', async function () {
    mountWithTheme(
      <CreateTeamModal
        Body={p => p.children}
        Header={p => p.children}
        organization={org}
        closeModal={closeModal}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    userEvent.type(screen.getByText('Team Name'), 'new-team');
    userEvent.click(screen.getByLabelText('Create Team'));

    await waitFor(() => expect(createTeam).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
