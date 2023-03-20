import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as useApi from 'sentry/utils/useApi';

import {EvidencePreview} from './evidencePreview';

describe('EvidencePreview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.restoreAllMocks();
  });

  it('does not fetch before hover', () => {
    const api = new MockApiClient();
    jest.spyOn(useApi, 'default').mockReturnValue(api);
    const spy = jest.spyOn(api, 'requestPromise');

    render(
      <EvidencePreview eventId="event-id" projectSlug="project-slug" groupId="group-id">
        Hover me
      </EvidencePreview>
    );

    jest.runAllTimers();

    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches from event URL when event and project are provided', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/event-id/`,
      body: null,
    });

    render(
      <EvidencePreview eventId="event-id" projectSlug="project-slug" groupId="group-id">
        Hover me
      </EvidencePreview>
    );

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await waitFor(() => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('fetches from group URL when only group ID is provided', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/issues/group-id/events/latest/`,
      body: null,
    });

    render(<EvidencePreview groupId="group-id">Hover me</EvidencePreview>);

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await waitFor(() => {
      expect(mock).toHaveBeenCalled();
    });
  });

  it('shows error when request fails', async () => {
    const api = new MockApiClient();
    jest.spyOn(useApi, 'default').mockReturnValue(api);
    jest.spyOn(api, 'requestPromise').mockRejectedValue(new Error());

    render(<EvidencePreview groupId="group-id">Hover me</EvidencePreview>);

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await screen.findByText('Failed to load preview');
  });

  it('renders the span evidence correctly when request succeeds', async () => {
    const event = TestStubs.Event({
      occurrence: {
        evidenceDisplay: [
          {name: 'Transaction', value: '/api/0/transaction-test-endpoint/'},
          {name: 'Parent Span', value: 'db - connect'},
          {name: 'Repeating Span', value: 'db - group me'},
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/issues/group-id/events/latest/`,
      body: event,
    });

    render(<EvidencePreview groupId="group-id">Hover me</EvidencePreview>);

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await screen.findByTestId('evidence-preview-body');

    expect(screen.getByRole('cell', {name: 'Transaction'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {name: '/api/0/transaction-test-endpoint/'})
    ).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Parent Span'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'db - connect'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Repeating Span'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'db - group me'})).toBeInTheDocument();
  });
});
