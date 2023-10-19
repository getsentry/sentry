import {render, screen} from 'sentry-test/reactTestingLibrary';

import {StepTitle} from 'sentry/components/onboarding/gettingStartedDoc/step';

import {GettingStartedWithGCPFunctions, steps} from './gcpfunctions';

describe('GettingStartedWithGCPFunctions', function () {
  it('all products are selected', function () {
    render(<GettingStartedWithGCPFunctions dsn="test-dsn" projectSlug="test-project" />);

    // Steps
    for (const step of steps({
      installSnippet: 'test-install-snippet',
      importContent: 'test-import-content',
      initContent: 'test-init-content',
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
