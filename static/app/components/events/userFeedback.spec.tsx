import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {UserReport} from 'sentry/types/group';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

import {EventUserFeedback} from './userFeedback';

jest.mock('sentry/utils/useCopyToClipboard');
const mockCopy = jest.fn();
jest.mocked(useCopyToClipboard).mockReturnValue({copy: mockCopy});

function makeReport(overrides: Partial<UserReport> = {}): UserReport {
  return {
    comments: 'Line one\n<script>alert("x")</script>',
    dateCreated: '2024-01-01T00:00:00.000Z',
    email: 'jane@example.com',
    event: {eventID: 'abc123', id: '1'},
    eventID: 'abc123',
    id: '1',
    issue: {} as UserReport['issue'],
    name: 'Jane Reporter',
    user: {
      avatarUrl: null,
      email: 'jane@example.com',
      id: '1',
      ipAddress: null,
      name: 'Jane Reporter',
      username: 'jane',
    },
    ...overrides,
  };
}

describe('EventUserFeedback', () => {
  beforeEach(() => {
    mockCopy.mockClear();
  });

  it('renders feedback details and copies the reporter email', async () => {
    render(
      <EventUserFeedback
        report={makeReport()}
        eventLink="/organizations/org-slug/issues/123/events/abc123/?referrer=user-feedback"
      />
    );

    expect(screen.getByText('Jane Reporter')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View event'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/events/abc123/?referrer=user-feedback'
    );

    const emailButton = screen.getByRole('button', {name: 'jane@example.com'});
    await userEvent.click(emailButton);

    expect(mockCopy).toHaveBeenCalledWith('jane@example.com', {
      successMessage: 'Copied email to clipboard',
    });
  });

  it('does not repeat the email when it matches the reporter name', async () => {
    render(
      <EventUserFeedback
        report={makeReport({
          email: 'jane@example.com',
          name: 'Jane@Example.com',
        })}
      />
    );

    expect(screen.getAllByText('Jane@Example.com')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', {name: 'Copy email address'}));

    expect(mockCopy).toHaveBeenCalledWith('jane@example.com', {
      successMessage: 'Copied email to clipboard',
    });
  });

  it('preserves comment text without rendering html and hides the event link', () => {
    render(<EventUserFeedback report={makeReport({user: null})} />);

    expect(screen.queryByRole('link', {name: 'View event'})).not.toBeInTheDocument();
    expect(screen.getByTestId('letter_avatar-avatar')).toHaveTextContent('JR');
    expect(document.querySelector('script')).not.toBeInTheDocument();
    const comment = document.querySelector('p');
    expect(comment?.textContent).toBe('Line one\n<script>alert("x")</script>');
  });
});
