import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithExpress, steps} from './express';

describe('GettingStartedWithExpress', function () {
  it('renders doc correctly', function () {
    const {container} = render(<GettingStartedWithExpress dsn="test-dsn" />);

    // Steps
    for (const step of steps({
      installSnippet: 'test-install-snippet',
      importContent: 'test-import-content',
      initContent: 'test-init-content',
      hasPerformanceMonitoring: true,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
