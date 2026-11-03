import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {AnchoredActionRequests} from 'sentry/views/investigations/actionRequests/anchoredActionRequests';
import {InvestigationActionRequestFixture} from 'sentry/views/investigations/fixtures';
import type {InvestigationActionRequest} from 'sentry/views/investigations/types';

const aboutCause = {
  primary: false,
  anchor: {type: 'hypothesis', id: 'hypothesis-1', blockId: null},
} as const;

const advice = {
  ...aboutCause,
  action: null,
  canApply: false,
  cannotApplyReason: 'unsupported_action',
} as const;

const staleRequest = InvestigationActionRequestFixture({
  ...aboutCause,
  title: 'Widen the interval for declines',
  state: 'superseded',
  canApply: false,
  cannotApplyReason: 'not_suggested',
  error: {code: 'stale', current: {timeWindowSeconds: 600}},
});

function renderRequests(actionRequests: InvestigationActionRequest[]) {
  return render(
    <AnchoredActionRequests
      actionRequests={actionRequests}
      investigationId="investigation-1"
    />
  );
}

describe('AnchoredActionRequests', () => {
  it('renders nothing when every request is hidden', () => {
    const {container} = renderRequests([
      InvestigationActionRequestFixture({
        ...aboutCause,
        title: 'Old advice',
        state: 'superseded',
        canApply: false,
        cannotApplyReason: 'not_suggested',
      }),
    ]);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows only the newest withdrawn request for each anchor', () => {
    const withdrawn = {...advice, state: 'withdrawn'} as const;
    renderRequests([
      InvestigationActionRequestFixture({
        ...withdrawn,
        id: '331',
        key: 'second',
        title: 'Second advice',
        reportRevision: 3,
      }),
      InvestigationActionRequestFixture({
        ...withdrawn,
        id: '330',
        key: 'first',
        title: 'First advice',
        dateCreated: '2026-08-28T11:10:00Z',
      }),
    ]);

    expect(screen.getByRole('region', {name: 'Second advice'})).toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'First advice'})).not.toBeInTheDocument();
  });

  it('hides a withdrawn request next to a live one for the same anchor', () => {
    renderRequests([
      InvestigationActionRequestFixture({
        id: '330',
        key: 'first',
        ...advice,
        state: 'withdrawn',
        title: 'First advice',
      }),
      InvestigationActionRequestFixture({
        id: '331',
        key: 'second',
        ...advice,
        title: 'Second advice',
      }),
    ]);

    expect(screen.getByRole('region', {name: 'Second advice'})).toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'First advice'})).not.toBeInTheDocument();
  });

  it('renders a withdrawn reason as plain text', () => {
    renderRequests([
      InvestigationActionRequestFixture({
        ...advice,
        state: 'withdrawn',
        title: 'Old advice',
        reason: '[see this](https://example.com)',
      }),
    ]);

    const withdrawn = screen.getByRole('region', {name: 'Old advice'});
    expect(withdrawn).toHaveTextContent('[see this](https://example.com)');
    expect(within(withdrawn).queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps a stale request with its notice', () => {
    renderRequests([staleRequest]);

    const card = screen.getByRole('region', {name: 'Widen the interval for declines'});
    expect(within(card).getByRole('status')).toHaveTextContent(
      'The monitor changed since Seer suggested this.'
    );
    expect(within(card).getByText('Now: 10 minutes')).toBeInTheDocument();
  });

  it('says Seer is checking a stale request again', () => {
    renderRequests([
      {
        ...staleRequest,
        followUp: {status: 'accepted', reason: null, rerun: null, retryable: false},
      },
    ]);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Seer is checking the suggestion again…'
    );
  });

  it('drops a stale request once Seer has new advice for the same cause', () => {
    renderRequests([
      staleRequest,
      InvestigationActionRequestFixture({
        ...aboutCause,
        id: '340',
        key: 'check-decline-codes',
        title: 'Check the decline codes',
        reportRevision: 3,
        ...advice,
      }),
    ]);

    expect(
      screen.getByRole('region', {name: 'Check the decline codes'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Widen the interval for declines'})
    ).not.toBeInTheDocument();
  });

  it('keeps a stale request next to older advice for the same cause', () => {
    renderRequests([
      InvestigationActionRequestFixture({
        ...aboutCause,
        id: '400',
        key: 'check-decline-codes',
        title: 'Check the decline codes',
        reportRevision: 1,
        ...advice,
      }),
      staleRequest,
    ]);

    expect(
      screen.getByRole('region', {name: 'Check the decline codes'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', {name: 'Widen the interval for declines'})
    ).toBeInTheDocument();
  });

  it('keeps a stale request next to other advice from the same report', () => {
    renderRequests([
      staleRequest,
      InvestigationActionRequestFixture({
        ...advice,
        id: '340',
        key: 'check-decline-codes',
        title: 'Check the decline codes',
        reportRevision: staleRequest.reportRevision,
        dateCreated: '2030-01-01T00:00:00Z',
      }),
    ]);

    expect(
      screen.getByRole('region', {name: 'Check the decline codes'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', {name: 'Widen the interval for declines'})
    ).toBeInTheDocument();
  });

  it('drops a stale request once Seer replaces it in the same report', () => {
    renderRequests([
      staleRequest,
      InvestigationActionRequestFixture({
        ...advice,
        id: '340',
        key: staleRequest.key,
        title: 'Widen the interval a little',
        reportRevision: staleRequest.reportRevision,
        dateCreated: '2030-01-01T00:00:00Z',
      }),
    ]);

    expect(
      screen.getByRole('region', {name: 'Widen the interval a little'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Widen the interval for declines'})
    ).not.toBeInTheDocument();
  });

  it('keeps a stale request without an anchor next to unrelated advice', () => {
    renderRequests([
      {...staleRequest, anchor: null},
      InvestigationActionRequestFixture({
        ...advice,
        anchor: null,
        id: '340',
        key: 'check-decline-codes',
        title: 'Check the decline codes',
        reportRevision: 3,
      }),
    ]);

    expect(
      screen.getByRole('region', {name: 'Check the decline codes'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', {name: 'Widen the interval for declines'})
    ).toBeInTheDocument();
  });
});
