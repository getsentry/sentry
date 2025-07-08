import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ConfigStore from 'sentry/stores/configStore';
import * as useNavigateModule from 'sentry/utils/useNavigate';

import RelocationDetails from 'admin/views/relocationDetails';

jest.mock('sentry/actionCreators/indicator');

describe('Relocation Details', function () {
  const in_progress_relocation_uuid = '9f14e990-dd8d-4f45-b759-a8982692e530';
  const paused_relocation_uuid = '589376f2-ab6a-4476-abed-81f0a26446d6';

  function get_in_progress_relocation_model(): Record<string, any> {
    return {
      dateAdded: '2023-12-18T07:02:03:45.678Z',
      dateUpdated: '2023-12-18T08:02:03:45.678Z',
      uuid: in_progress_relocation_uuid,
      creator: {
        email: 'admin@example.com',
        id: '1',
        username: 'admin',
      },
      owner: {
        email: 'claire@example.com',
        id: '4',
        username: 'claire',
      },
      status: 'IN_PROGRESS',
      step: 'UPLOADING',
      provenance: 'SELF_HOSTED',
      failureReason: null,
      scheduledPauseAtStep: null,
      scheduledCancelAtStep: null,
      wantOrgSlugs: ['qux'],
      wantUsernames: ['claire', 'david'],
      latestNotified: 'STARTED',
      latestUnclaimedEmailsSentAt: null,
    };
  }

  function get_paused_relocation_model(): Record<string, any> {
    return {
      dateAdded: '2023-12-18T05:02:03:45.678Z',
      dateUpdated: '2023-12-18T06:02:03:45.678Z',
      uuid: paused_relocation_uuid,
      creator: {
        email: 'admin@example.com',
        id: '1',
        username: 'admin',
      },
      owner: {
        email: 'bob@example.com',
        id: '2',
        username: 'bob',
      },
      status: 'PAUSE',
      step: 'VALIDATING',
      provenance: 'SELF_HOSTED',
      failureReason: null,
      scheduledPauseAtStep: null,
      scheduledCancelAtStep: null,
      wantOrgSlugs: ['bar'],
      wantUsernames: ['david'],
      latestNotified: null,
      latestUnclaimedEmailsSentAt: null,
    };
  }

  beforeEach(function () {
    ConfigStore.set('regions', [
      {
        name: 'test',
        url: 'https://example.com/api/0/',
      },
    ]);
  });

  it('renders', async function () {
    const uuid = in_progress_relocation_uuid;
    const model = get_in_progress_relocation_model();

    MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/`,
      method: 'GET',
      body: model,
    });

    render(<RelocationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/relocations/test/${uuid}/`,
        },
        route: `/admin/relocations/:regionName/:relocationUuid/`,
      },
    });

    expect(await screen.findByRole('heading', {name: 'Relocation'})).toBeInTheDocument();

    expect(screen.getAllByText(uuid)).toHaveLength(1);
    expect(screen.getAllByText('SELF_HOSTED')).toHaveLength(1);
    expect(screen.getAllByText('test')).toHaveLength(1);
    expect(screen.getAllByText('Working')).toHaveLength(1);
    expect(screen.getAllByText('admin@example.com')).toHaveLength(1);
    expect(screen.getAllByText('claire@example.com')).toHaveLength(1);
    expect(screen.getAllByText('--')).toHaveLength(2);
    expect(screen.getAllByText('qux')).toHaveLength(1);
    expect(screen.getAllByText('claire, david')).toHaveLength(1);
  });

  it('pauses and unpauses in progress relocation', async function () {
    const uuid = in_progress_relocation_uuid;
    const model = get_in_progress_relocation_model();

    MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/`,
      method: 'GET',
      body: model,
    });

    render(<RelocationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/relocations/test/${uuid}/`,
        },
        route: `/admin/relocations/:regionName/:relocationUuid/`,
      },
    });

    await waitFor(() => expect(screen.getAllByText('Working')).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText('--')).toHaveLength(2));

    const {waitForModalToHide} = renderGlobalModal();

    // Set a pause.
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(screen.getByText('Schedule Pause')).toBeInTheDocument();
    expect(screen.queryByText('Unpause')).not.toBeInTheDocument();
    expect(screen.getByText('Schedule Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    model.scheduledPauseAtStep = 'PREPROCESSING';
    const firstPauseCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/pause/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Schedule Pause'));
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Scheduled At'}));
    [
      'As soon as possible',
      'Preprocessing',
      'Validating',
      'Importing',
      'Postprocessing',
    ].forEach(step => expect(screen.getByText(step)).toBeInTheDocument());
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Scheduled At'}),
      'As soon as possible'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Schedule'}));
    await waitForModalToHide();
    expect(screen.getAllByText('Preprocessing')).toHaveLength(1);
    expect(screen.getAllByText('--')).toHaveLength(1);
    expect(firstPauseCall.mock.calls[0][1].data.atStep).toBeUndefined();

    // Change the pause step.
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(screen.getByText('Schedule Pause')).toBeInTheDocument();
    expect(screen.getByText('Unpause')).toBeInTheDocument();
    expect(screen.getByText('Schedule Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    model.scheduledPauseAtStep = 'VALIDATING';
    const secondPauseCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/pause/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Schedule Pause'));
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Scheduled At'}));
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Scheduled At'}),
      'Validating'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Schedule'}));
    await waitForModalToHide();
    expect(secondPauseCall.mock.calls[0][1].data.atStep).toBe('VALIDATING');
    expect(screen.queryByText('Preprocessing')).not.toBeInTheDocument();
    expect(screen.getAllByText('Validating')).toHaveLength(1);
    expect(screen.getAllByText('--')).toHaveLength(1);

    // Remove pause.
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(screen.getByText('Schedule Pause')).toBeInTheDocument();
    expect(screen.getByText('Unpause')).toBeInTheDocument();
    expect(screen.getByText('Schedule Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    model.scheduledPauseAtStep = null;
    const unpauseCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/unpause/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Unpause'));
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Until'}));
    await selectEvent.select(screen.getByRole('textbox', {name: 'Until'}), 'Completion');
    await userEvent.click(screen.getByRole('button', {name: 'Unpause'}));
    await waitForModalToHide();
    expect(unpauseCall.mock.calls[0][1].data.untilStep).toBeUndefined();
    expect(screen.queryByText('Preprocessing')).not.toBeInTheDocument();
    expect(screen.queryByText('Validating')).not.toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
  });

  it('unpauses paused relocation', async function () {
    const uuid = paused_relocation_uuid;
    const model = get_paused_relocation_model();

    MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/`,
      method: 'GET',
      body: model,
    });

    render(<RelocationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/relocations/test/${uuid}/`,
        },
        route: `/admin/relocations/:regionName/:relocationUuid/`,
      },
    });

    await waitFor(() => expect(screen.getAllByText('Paused')).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText('--')).toHaveLength(3));

    const {waitForModalToHide} = renderGlobalModal();

    // Unpause.
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(screen.queryByText('Schedule Pause')).not.toBeInTheDocument();
    expect(screen.getByText('Unpause')).toBeInTheDocument();
    expect(screen.getByText('Schedule Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    model.status = 'IN_PROGRESS';
    const unpauseCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/unpause/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Unpause'));
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Until'}));
    ['Completion', 'Importing', 'Postprocessing'].forEach(step =>
      expect(screen.getByText(step)).toBeInTheDocument()
    );
    expect(screen.queryByText('Validating')).not.toBeInTheDocument();

    await selectEvent.select(screen.getByRole('textbox', {name: 'Until'}), 'Completion');
    await userEvent.click(screen.getByRole('button', {name: 'Unpause'}));
    await waitForModalToHide();
    expect(unpauseCall.mock.calls[0][1].data.untilStep).toBeUndefined();
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
    expect(screen.getByText('Working')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(3);
  });

  it('has only `Show Artifacts` in action menu for already succeeded relocation', async function () {
    const uuid = 'd39f84fc-554a-4d7d-95b7-78f983bcba73';
    const model: Record<string, any> = {
      dateAdded: '2023-12-18T01:02:03:45.678Z',
      dateUpdated: '2023-12-18T02:02:03:45.678Z',
      uuid,
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
      status: 'SUCCESS',
      step: 'IMPORTING',
      provenance: 'SELF_HOSTED',
      failureReason: 'A failure reason',
      scheduledPauseAtStep: null,
      scheduledCancelAtStep: null,
      wantOrgSlugs: ['foo'],
      wantUsernames: ['alice', 'david'],
    };

    MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/`,
      method: 'GET',
      body: model,
    });

    render(<RelocationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/relocations/test/${uuid}/`,
        },
        route: `/admin/relocations/:regionName/:relocationUuid/`,
      },
    });

    await userEvent.click(await screen.findByText('Relocation Actions'));
    expect(screen.getByText('Show Artifacts')).toBeInTheDocument();
    expect(screen.queryByText('Schedule Pause')).not.toBeInTheDocument();
    expect(screen.queryByText('Unpause')).not.toBeInTheDocument();
    expect(screen.queryByText('Schedule Cancellation')).not.toBeInTheDocument();
    expect(screen.queryByText('Abort')).not.toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('cancels and aborts incomplete relocation', async function () {
    const uuid = in_progress_relocation_uuid;
    const model = get_in_progress_relocation_model();
    model.step = 'PREPROCESSING';

    MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/`,
      method: 'GET',
      body: model,
    });

    render(<RelocationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/relocations/test/${uuid}/`,
        },
        route: `/admin/relocations/:regionName/:relocationUuid/`,
      },
    });

    await waitFor(() => expect(screen.getAllByText('Working')).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByText('--')).toHaveLength(2));

    const {waitForModalToHide} = renderGlobalModal();

    // Cancel
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(screen.getByText('Schedule Pause')).toBeInTheDocument();
    expect(screen.queryByText('Unpause')).not.toBeInTheDocument();
    expect(screen.getByText('Schedule Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    model.scheduledCancelAtStep = 'VALIDATING';
    const firstCancelCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/cancel/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Schedule Cancellation'));
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Scheduled At'}));
    ['As soon as possible', 'Validating', 'Importing', 'Postprocessing'].forEach(step =>
      expect(screen.getByText(step)).toBeInTheDocument()
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Scheduled At'}),
      'As soon as possible'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Schedule'}));
    await waitForModalToHide();
    expect(screen.getAllByText('Cancelling')).toHaveLength(1);
    expect(firstCancelCall.mock.calls[0][1].data.atStep).toBeUndefined();

    // Change the cancel step.
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(screen.getByText('Schedule Pause')).toBeInTheDocument();
    expect(screen.queryByText('Unpause')).not.toBeInTheDocument();
    expect(screen.getByText('Schedule Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    model.scheduledCancelAtStep = 'NOTIFYING';
    const secondCancelCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/cancel/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Schedule Cancellation'));
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Scheduled At'}));
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Scheduled At'}),
      'Notifying'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Schedule'}));
    await waitForModalToHide();
    expect(secondCancelCall.mock.calls[0][1].data.atStep).toBe('NOTIFYING');
    expect(screen.getAllByText('Cancelling')).toHaveLength(1);

    // Abort.
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(screen.getByText('Schedule Pause')).toBeInTheDocument();
    expect(screen.queryByText('Unpause')).not.toBeInTheDocument();
    expect(screen.getByText('Schedule Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    model.status = 'FAILURE';
    model.scheduledCancelAtStep = null;
    model.failureReason = 'Some reason';
    const abortCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/abort/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Abort'));
    await userEvent.click(screen.getByRole('button', {name: 'Abort'}));
    await waitForModalToHide();
    await waitFor(() => expect(abortCall).toHaveBeenCalled());
    expect(abortCall).toHaveBeenCalled();
    expect(screen.getAllByText('Failed')).toHaveLength(1);
    expect(screen.getByText('Some reason')).toBeInTheDocument();
  });

  it('hides cancel and pause actions on penultimate step', async function () {
    const uuid = paused_relocation_uuid;
    const model = get_paused_relocation_model();
    model.step = 'NOTIFYING';

    MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/`,
      method: 'GET',
      body: model,
    });

    render(<RelocationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/relocations/test/${uuid}/`,
        },
        route: `/admin/relocations/:regionName/:relocationUuid/`,
      },
    });

    // Unpause.
    await userEvent.click(await screen.findByText('Relocation Actions'));
    expect(screen.queryByText('Schedule Pause')).not.toBeInTheDocument();
    expect(screen.getByText('Unpause')).toBeInTheDocument();
    expect(screen.queryByText('Schedule Cancellation')).not.toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();

    const {waitForModalToHide} = renderGlobalModal();

    model.status = 'IN_PROGRESS';
    const unpauseCall = MockApiClient.addMockResponse({
      url: `/relocations/${uuid}/unpause/`,
      method: 'PUT',
      body: model,
    });
    await userEvent.click(screen.getByText('Unpause'));
    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Until'}));
    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.queryByText('Notifying')).not.toBeInTheDocument();

    await selectEvent.select(screen.getByRole('textbox', {name: 'Until'}), 'Completion');
    await userEvent.click(screen.getByRole('button', {name: 'Unpause'}));
    await waitForModalToHide();
    await userEvent.click(screen.getByText('Relocation Actions'));
    expect(unpauseCall.mock.calls[0][1].data.untilStep).toBeUndefined();
    expect(screen.queryByText('Schedule Pause')).not.toBeInTheDocument();
    expect(screen.queryByText('Unpause')).not.toBeInTheDocument();
    expect(screen.queryByText('Schedule Cancellation')).not.toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
  });

  it('retries failed relocation', async function () {
    const navigate = jest.fn();
    jest.spyOn(useNavigateModule, 'useNavigate').mockReturnValue(navigate);

    const old_uuid = paused_relocation_uuid;
    const old_model = get_paused_relocation_model();
    old_model.status = 'FAILURE';

    MockApiClient.addMockResponse({
      url: `/relocations/${old_uuid}/`,
      method: 'GET',
      body: old_model,
    });

    render(<RelocationDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/admin/relocations/test/${old_uuid}/`,
        },
        route: `/admin/relocations/:regionName/:relocationUuid/`,
      },
    });

    // Unpause.
    await userEvent.click(await screen.findByText('Relocation Actions'));
    expect(screen.queryByText('Schedule Pause')).not.toBeInTheDocument();
    expect(screen.queryByText('Unpause')).not.toBeInTheDocument();
    expect(screen.queryByText('Schedule Cancellation')).not.toBeInTheDocument();
    expect(screen.queryByText('Abort')).not.toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();

    const {waitForModalToHide} = renderGlobalModal();

    const new_uuid = in_progress_relocation_uuid;
    const new_model = get_in_progress_relocation_model();
    const retryCall = MockApiClient.addMockResponse({
      url: `/relocations/${old_uuid}/retry/`,
      method: 'POST',
      body: new_model,
    });
    await userEvent.click(screen.getByText('Retry'));
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await waitForModalToHide();
    await waitFor(() => expect(retryCall).toHaveBeenCalled());
    expect(retryCall).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`/_admin/relocations/test/${new_uuid}/`);
  });
});
