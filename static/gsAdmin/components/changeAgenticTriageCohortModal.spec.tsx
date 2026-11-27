import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openChangeAgenticTriageCohortModal} from 'admin/components/changeAgenticTriageCohortModal';

describe('ChangeAgenticTriageCohortModal', () => {
  it('sets the selected cohort', async () => {
    const organization = OrganizationFixture({agenticTriageCohort: null});
    const onSuccess = jest.fn();
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    renderGlobalModal();
    act(() => openChangeAgenticTriageCohortModal({organization, onSuccess}));

    await userEvent.click(await screen.findByRole('textbox', {name: 'Cohort'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Free'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({method: 'PUT', data: {agenticTriageCohort: 'free'}})
    );
  });

  it('clears the cohort when None is selected', async () => {
    const organization = OrganizationFixture({agenticTriageCohort: 'seat'});
    const onSuccess = jest.fn();
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    renderGlobalModal();
    act(() => openChangeAgenticTriageCohortModal({organization, onSuccess}));

    await userEvent.click(await screen.findByRole('textbox', {name: 'Cohort'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'None'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({method: 'PUT', data: {agenticTriageCohort: null}})
    );
  });
});
