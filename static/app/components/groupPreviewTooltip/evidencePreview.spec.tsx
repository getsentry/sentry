import {EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EvidencePreview} from './evidencePreview';

describe('EvidencePreview', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/',
    });
  });

  it('shows error when request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/events/recommended/',
      statusCode: 500,
    });

    render(<EvidencePreview groupId="group-id">Hover me</EvidencePreview>);

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await screen.findByText('Failed to load preview');
  });

  it('renders the span evidence correctly when request succeeds', async () => {
    const event = EventFixture({
      occurrence: {
        evidenceDisplay: [
          {name: 'Transaction', value: '/api/0/transaction-test-endpoint/'},
          {name: 'Parent Span', value: 'db - connect'},
          {name: 'Repeating Span', value: 'db - group me'},
        ],
      },
    });

    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/group-id/events/recommended/`,
      body: event,
    });

    render(<EvidencePreview groupId="group-id">Hover me</EvidencePreview>);

    // Does not fetch before hover
    expect(mockApi).not.toHaveBeenCalled();

    await userEvent.hover(screen.getByText('Hover me'), {delay: null});

    await screen.findByTestId('evidence-preview-body');

    // Fetches after hover
    expect(mockApi).toHaveBeenCalled();

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
