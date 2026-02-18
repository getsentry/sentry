import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ScheduleReportModal from 'sentry/components/modals/scheduleReportModal';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

function renderModal(
  props: Partial<React.ComponentProps<typeof ScheduleReportModal>> = {}
) {
  const organization = OrganizationFixture({
    features: ['scheduled-reports'],
  });
  const closeModal = jest.fn();

  const defaults: React.ComponentProps<typeof ScheduleReportModal> = {
    Header: stubEl,
    Footer: stubEl as ModalRenderProps['Footer'],
    Body: stubEl as ModalRenderProps['Body'],
    CloseButton: stubEl,
    closeModal,
    organization,
    sourceType: 'explore_saved_query',
    sourceId: 42,
    sourceName: 'My Saved Query',
    ...props,
  };

  const result = render(<ScheduleReportModal {...defaults} />);
  return {...result, closeModal, organization};
}

describe('ScheduleReportModal', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [
        MemberFixture({id: '1', email: 'alice@example.com', name: 'Alice'}),
        MemberFixture({id: '2', email: 'bob@example.com', name: 'Bob'}),
        MemberFixture({
          id: '3',
          email: 'pending@example.com',
          name: 'Pending',
          pending: true,
        }),
      ],
    });
  });

  it('renders the modal with default values', async () => {
    renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: 'Schedule Report'})).toBeInTheDocument();
    expect(screen.getByText('Frequency')).toBeInTheDocument();
    expect(screen.getByText('Recipients')).toBeInTheDocument();

    expect(screen.getByRole('textbox')).toHaveValue('My Saved Query');

    expect(screen.getByRole('radio', {name: 'Daily'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Weekly'})).not.toBeChecked();
    expect(screen.getByRole('radio', {name: 'Monthly'})).not.toBeChecked();

    expect(screen.getByRole('button', {name: 'Send Test Email'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Schedule Report'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('shows multi-query warning when isMultiQuery is true', async () => {
    renderModal({isMultiQuery: true});

    expect(
      await screen.findByText('Only the first query will be included in the report.')
    ).toBeInTheDocument();
  });

  it('does not show multi-query warning when isMultiQuery is false', async () => {
    renderModal({isMultiQuery: false});

    expect(await screen.findByText('Report Name')).toBeInTheDocument();
    expect(
      screen.queryByText('Only the first query will be included in the report.')
    ).not.toBeInTheDocument();
  });

  it('disables Schedule Report button when name is empty', async () => {
    renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    const nameInput = screen.getByRole('textbox');
    await userEvent.clear(nameInput);

    expect(screen.getByRole('button', {name: 'Schedule Report'})).toBeDisabled();
  });

  it('submits the schedule request on Schedule Report click', async () => {
    const createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/scheduled-reports/',
      method: 'POST',
      body: {id: '1'},
    });

    const {closeModal} = renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Schedule Report'}));

    await waitFor(() => expect(createMock).toHaveBeenCalled());

    const requestData = createMock.mock.calls[0][1].data;
    expect(requestData).toMatchObject({
      name: 'My Saved Query',
      sourceType: 'explore_saved_query',
      sourceId: 42,
      frequency: 'daily',
    });
    expect(requestData.hour).toBeDefined();

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
  });

  it('sends a test email on Send Test Email click', async () => {
    const testMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/scheduled-reports/test/',
      method: 'POST',
      body: {detail: 'Test email sent.'},
    });

    renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Send Test Email'}));

    await waitFor(() => expect(testMock).toHaveBeenCalled());

    const requestData = testMock.mock.calls[0][1].data;
    expect(requestData).toMatchObject({
      name: 'My Saved Query',
      sourceType: 'explore_saved_query',
      sourceId: 42,
      frequency: 'daily',
    });
  });

  it('shows error message when schedule request fails', async () => {
    jest.spyOn(indicators, 'addErrorMessage');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/scheduled-reports/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Bad request'},
    });

    renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Schedule Report'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Failed to schedule report'
      );
    });
  });

  it('shows error message when test send fails', async () => {
    jest.spyOn(indicators, 'addErrorMessage');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/scheduled-reports/test/',
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Send Test Email'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Failed to send test email'
      );
    });
  });

  it('closes modal on Cancel click', async () => {
    const {closeModal} = renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(closeModal).toHaveBeenCalled();
  });

  it('allows changing frequency to weekly', async () => {
    renderModal();

    expect(await screen.findByText('Report Name')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Weekly'}));

    expect(screen.getByRole('radio', {name: 'Weekly'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Daily'})).not.toBeChecked();
  });
});
