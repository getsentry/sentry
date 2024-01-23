import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AiAutofix} from 'sentry/components/events/aiAutofix';
import {useAiAutofix} from 'sentry/components/events/aiAutofix/useAiAutofix';
import {Group} from 'sentry/types';

jest.mock('sentry/components/events/aiAutofix/useAiAutofix', () => ({
  useAiAutofix: jest.fn(() => ({
    autofixData: null,
    triggerAutofix: jest.fn(),
    additionalContext: '',
    setAdditionalContext: jest.fn(),
    error: null,
    isError: false,
    isPolling: false,
  })),
}));

const group = {
  /* Mock group data */
  id: 1,
} as unknown as Group;

describe('AiAutofix', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders the Banner component when autofixData is null', () => {
    render(<AiAutofix group={group} />);

    expect(screen.getByText('AI Autofix')).toBeInTheDocument();
  });

  it('renders the FixResult component when autofixData is present', () => {
    (useAiAutofix as jest.Mock).mockReturnValue({
      autofixData: {
        status: 'SUCCESS',
        fix: {
          title: 'Fixed the bug!',
        },
      },
      triggerAutofix: jest.fn(),
      additionalContext: '',
      setAdditionalContext: jest.fn(),
      error: null,
      isError: false,
      isPolling: false,
    });

    render(<AiAutofix group={group} />);

    expect(screen.getByText('Fixed the bug!')).toBeInTheDocument();
    expect(screen.getByText('View Pull Request')).toBeInTheDocument();
  });
});
