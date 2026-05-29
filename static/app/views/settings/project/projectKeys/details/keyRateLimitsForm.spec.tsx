import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ProjectKey} from 'sentry/types/project';
import {KeyRateLimitsForm} from 'sentry/views/settings/project/projectKeys/details/keyRateLimitsForm';

describe('KeyRateLimitsForm', () => {
  const org = OrganizationFixture();
  const project = ProjectFixture({features: ['rate-limits']});
  const baseKey = ProjectKeysFixture()[0]!;

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

  it('sends a PUT request when the count is changed and blurred', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByPlaceholderText('Count');
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '10');
    await userEvent.tab();

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        `/projects/${org.slug}/${project.slug}/keys/${baseKey.id}/`,
        expect.objectContaining({
          data: {rateLimit: {count: 10, window: 60}},
        })
      );
    });
  });

  it('does not submit when count is cleared while window is set', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByPlaceholderText('Count');
    await userEvent.clear(countInput);
    await userEvent.tab();

    expect(putMock).not.toHaveBeenCalled();
  });

  it('does not send a request when value has not changed', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByPlaceholderText('Count');
    await userEvent.click(countInput);
    await userEvent.tab();

    expect(putMock).not.toHaveBeenCalled();
  });

  it('shows a save indicator after successful save', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByPlaceholderText('Count');
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '10');
    await userEvent.tab();

    await waitFor(() => {
      expect(putMock).toHaveBeenCalled();
    });

    expect(await screen.findByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('calls updateData on successful save', async () => {
    const keyWithRateLimit: ProjectKey = {
      ...baseKey,
      rateLimit: {count: 5, window: 60},
    };
    const {putMock, updateData} = renderForm(keyWithRateLimit);

    const countInput = await screen.findByPlaceholderText('Count');
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '10');
    await userEvent.tab();

    await waitFor(() => {
      expect(putMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(updateData).toHaveBeenCalled();
    });
  });

  it('does not submit when count is 0 and slider is moved', async () => {
    const {putMock} = renderForm(baseKey);

    const slider = screen.getByRole('slider');
    act(() => {
      slider.focus();
    });
    await userEvent.keyboard('{ArrowRight}');

    expect(putMock).not.toHaveBeenCalled();
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
