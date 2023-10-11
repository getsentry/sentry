import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithExpress, steps} from './express';

describe('GettingStartedWithExpress', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithExpress dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      installSnippetYarn: 'test-install-snippet-yarn',
      installSnippetNpm: 'test-install-snippet-npm',
      importContent: 'test-import-content',
      initContent: 'test-init-content',
      hasPerformanceMonitoring: true,
      sourceMapStep: {
        title: 'Upload Source Maps',
      },
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
