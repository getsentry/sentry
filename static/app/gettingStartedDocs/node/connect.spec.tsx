import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithConnect, steps} from './connect';

describe('GettingStartedWithConnect', function () {
  it('renders doc correctly', function () {
    const {container} = render(<GettingStartedWithConnect dsn="test-dsn" />);

    // Steps
    for (const step of steps({
      installSnippet: 'test-install-snippet',
      importContent: 'test-import-content',
      initContent: 'test-init-content',
    })) {
      expect(
        screen.getByRole('heading', {name: step.title ?? StepTitle[step.type]})
      ).toBeInTheDocument();
    }

    expect(container).toSnapshot();
  });
});
