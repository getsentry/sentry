import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ProjectKey} from 'sentry/types/project';
import {KeyRateLimitsForm} from 'sentry/views/settings/project/projectKeys/details/keyRateLimitsForm';

describe('KeyRateLimitsForm', () => {
  const org = OrganizationFixture();
  const project = ProjectFixture({features: ['rate-limits']});
  const baseKey = ProjectKeysFixture()[0];

  function renderForm(data: ProjectKey = baseKey) {
    const updateData = jest.fn();
    const putMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/${data.id}/`,
      method: 'PUT',
      body: {...data, rateLimit: null},
    });

    render(
      <KeyRateLimitsForm
        organization={org}
        keyId={data.id}
        projectId={project.slug}
        data={data}
        disabled={false}
        project={project}
        updateData={updateData}
      />,
      {organization: org}
    );

    return {putMock, updateData};
  }

  it('submits when save is clicked with valid count and window', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByRole('spinbutton', {name: 'Count'});
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '10');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        `/projects/${org.slug}/${project.slug}/keys/${baseKey.id}/`,
        expect.objectContaining({
          data: {rateLimit: {count: 10, window: 60}},
        })
      );
    });
  });

  it('does not submit when only count is set and window is none', async () => {
    const {putMock} = renderForm(baseKey);

    const countInput = await screen.findByRole('spinbutton', {name: 'Count'});
    await userEvent.type(countInput, '5');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(putMock).not.toHaveBeenCalled();
  });

  it('does not submit when only window is set and count is empty', async () => {
    const {putMock} = renderForm(baseKey);

    const slider = screen.getByRole('slider');
    act(() => {
      slider.focus();
    });
    await userEvent.keyboard('{ArrowRight}');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(putMock).not.toHaveBeenCalled();
  });

  it('submits null when both count and window are cleared', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByRole('spinbutton', {name: 'Count'});
    await userEvent.clear(countInput);

    const slider = screen.getByRole('slider');
    act(() => {
      slider.focus();
    });
    await userEvent.keyboard('{Home}');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        `/projects/${org.slug}/${project.slug}/keys/${baseKey.id}/`,
        expect.objectContaining({
          data: {rateLimit: null},
        })
      );
    });
  });

  it('resets form to initial values when reset is clicked', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    renderForm(keyWithRateLimit);

    const countInput = await screen.findByRole('spinbutton', {name: 'Count'});
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '99');

    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    expect(countInput).toHaveValue(5);
  });

  it('disables reset button when form has not changed', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    renderForm(keyWithRateLimit);

    await screen.findByRole('spinbutton', {name: 'Count'});

    expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled();
  });

  it('calls updateData on successful save', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock, updateData} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByRole('spinbutton', {name: 'Count'});
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '10');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(updateData).toHaveBeenCalled();
    });
  });

  it('submits when slider is moved and count is set', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock} = renderForm(keyWithRateLimit);

    const slider = screen.getByRole('slider');
    act(() => {
      slider.focus();
    });
    await userEvent.keyboard('{ArrowRight}');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        `/projects/${org.slug}/${project.slug}/keys/${baseKey.id}/`,
        expect.objectContaining({
          data: {rateLimit: {count: 5, window: 300}},
        })
      );
    });
  });
});
