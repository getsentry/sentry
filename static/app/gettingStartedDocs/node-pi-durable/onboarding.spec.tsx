import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('pi durable onboarding docs', () => {
  it('installs the minimum SDK version and preloads the instrument file', () => {
    renderWithOnboardingLayout(docs);

    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher(/npm install @sentry\/node@\^11\.6\.0/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(/node --import \.\/instrument\.mjs server\.mjs/)
      )
    ).toBeInTheDocument();
  });

  it('includes profiling and tracing options when selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /npm install @sentry\/node@\^11\.6\.0 @sentry\/profiling-node@\^11\.6\.0/
        )
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profileSessionSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('omits the tracing option when tracing is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).not.toBeInTheDocument();
  });
});
