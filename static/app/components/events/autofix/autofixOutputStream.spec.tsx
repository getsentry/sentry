import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';

import {AutofixOutputStream} from './autofixOutputStream';

jest.mock('sentry/actionCreators/indicator');

describe('AutofixOutputStream', () => {
  const mockApi = {
    requestPromise: jest.fn(),
  };

  beforeEach(() => {
    mockApi.requestPromise.mockReset();
    (addSuccessMessage as jest.Mock).mockClear();
    (addErrorMessage as jest.Mock).mockClear();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/autofix/update/',
      method: 'POST',
    });
  });

  it('renders basic stream content', async () => {
    render(
      <AutofixOutputStream
        stream="Hello World"
        groupId="123"
        runId="456"
        isProcessing={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
  });

  it('renders active log when provided', async () => {
    render(
      <AutofixOutputStream
        stream="Stream content"
        activeLog="Active log message"
        groupId="123"
        runId="456"
        isProcessing
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Active log message')).toBeInTheDocument();
    });
  });

  it('animates new stream content', async () => {
    const {rerender} = render(
      <AutofixOutputStream stream="Initial" groupId="123" runId="456" />
    );

    await waitFor(() => {
      expect(screen.getByText('Initial')).toBeInTheDocument();
    });

    rerender(
      <AutofixOutputStream stream="Initial content updated" groupId="123" runId="456" />
    );

    // Wait for animation to complete
    await waitFor(() => {
      expect(screen.getByText('Initial content updated')).toBeInTheDocument();
    });
  });
});
