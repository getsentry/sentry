import styled from '@emotion/styled';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {createTeam} from 'sentry/actionCreators/teams';
import {makeCloseButton} from 'sentry/components/globalModal/components';
import CreateTeamModal from 'sentry/components/modals/createTeamModal';

jest.mock('sentry/actionCreators/teams', () => ({
  createTeam: jest.fn((...args: any[]) => new Promise(resolve => resolve(args))),
}));

describe('CreateTeamModal', function () {
  const org = Organization();
  const closeModal = jest.fn();
  const onClose = jest.fn();

  beforeEach(function () {
    onClose.mockReset();
  });

  it('calls createTeam action creator on submit', async function () {
    const styledWrapper = styled(c => c.children);
    render(
      <CreateTeamModal
        Body={styledWrapper()}
        Footer={styledWrapper()}
        Header={p => <span>{p.children}</span>}
        organization={org}
        closeModal={closeModal}
        onClose={onClose}
        CloseButton={makeCloseButton(() => {})}
      />
    );

    await userEvent.type(screen.getByText('Team Name'), 'new-team');
    await userEvent.click(screen.getByLabelText('Create Team'));

    await waitFor(() => expect(createTeam).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  });
});
