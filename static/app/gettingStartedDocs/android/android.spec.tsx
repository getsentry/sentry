import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithAndroid, InstallationMode, steps} from './android';

describe('GettingStartedWithAndroid', function () {
  it('renders doc correctly', function () {
    render(<GettingStartedWithAndroid dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      hasPerformance: true,
      hasProfiling: true,
      installationMode: InstallationMode.AUTO,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
  it('renders Manual mode for Windows by default', function () {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.7.12) Gecko/20050915 Firefox/1.0.7',
    });
    render(<GettingStartedWithAndroid dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      dsn: 'test-dsn',
      hasPerformance: true,
      hasProfiling: true,
      installationMode: InstallationMode.MANUAL,
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }
  });
});
