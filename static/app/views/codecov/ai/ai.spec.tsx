import {render, screen} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import AIPage from 'sentry/views/codecov/ai/ai';

describe('AIPage', function () {
  it('renders empty selectors message when no context is available', function () {
    render(
      <CodecovQueryParamsProvider>
        <AIPage />
      </CodecovQueryParamsProvider>
    );

    expect(screen.getByText('AI-powered insights coming soon.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Please select a repository and branch to view AI-powered analytics data.'
      )
    ).toBeInTheDocument();
  });

  it('renders the main page structure', function () {
    render(
      <CodecovQueryParamsProvider>
        <AIPage />
      </CodecovQueryParamsProvider>
    );

    // Check for the main components that should always be present
    expect(screen.getByRole('combobox', {name: 'Organization'})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Repository'})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Branch'})).toBeInTheDocument();
  });
});
