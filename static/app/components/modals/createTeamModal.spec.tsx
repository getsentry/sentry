import styled from '@emotion/styled';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from '@sentry/scraps/modal';

import CreateTeamModal from 'sentry/components/modals/createTeamModal';

describe('CreateTeamModal', () => {
  const org = OrganizationFixture();
  const closeModal = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('creates a team and closes the modal on submit', async () => {
    const team = TeamFixture({slug: 'new-team'});
    const createRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'POST',
      body: team,
    });

    const styledWrapper = styled<any>((c: {children: React.ReactNode}) => c.children);
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

    await userEvent.type(screen.getByRole('textbox', {name: 'Team Slug'}), 'new-team');
    await userEvent.click(screen.getByLabelText('Create Team'));

    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(1));
    expect(createRequest).toHaveBeenCalledWith(
      `/organizations/${org.slug}/teams/`,
      expect.objectContaining({data: {slug: 'new-team'}})
    );
    expect(onClose).toHaveBeenCalledWith(team);
    expect(closeModal).toHaveBeenCalled();
  });
});
