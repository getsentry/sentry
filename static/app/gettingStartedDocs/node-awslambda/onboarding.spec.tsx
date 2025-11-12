import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {InstallationMethod} from './utils';
import docs from '.';

describe('awslambda onboarding docs', () => {
  describe('Lambda Layer', () => {
    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(docs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByText(textWithMarkupMatcher('ARN'))).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {name: /Upload Source Maps/i})
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'NODE_OPTIONS="--import @sentry/aws-serverless/awslambda-auto"'
          )
        )
      ).toBeInTheDocument();
    });
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/SENTRY_TRACES_SAMPLE_RATE/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/SENTRY_TRACES_SAMPLE_RATE=1\.0/))
    ).toBeInTheDocument();
  });

  it('enables performance setting the sample rate set to 1', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/SENTRY_TRACES_SAMPLE_RATE=1\.0/))
    ).toBeInTheDocument();
  });

  describe('NPM Package', () => {
    let npmDocs: typeof docs;
    beforeAll(() => {
      npmDocs = {
        ...docs,
        platformOptions: {
          ...docs.platformOptions,
          installationMethod: {
            ...docs.platformOptions!.installationMethod,
            defaultValue: InstallationMethod.NPM_PACKAGE,
          },
        },
      };
    });

    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(npmDocs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'NODE_OPTIONS="--import @sentry/aws-serverless/awslambda-auto"'
          )
        )
      ).toBeInTheDocument();
    });

    it('displays sample rates by default', () => {
      renderWithOnboardingLayout(npmDocs, {
        selectedProducts: [
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
          ProductSolution.PROFILING,
        ],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/SENTRY_TRACES_SAMPLE_RATE/))
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/SENTRY_TRACES_SAMPLE_RATE=1\.0/))
      ).toBeInTheDocument();
    });

    it('enables performance setting the sample rate set to 1', () => {
      renderWithOnboardingLayout(npmDocs, {
        selectedProducts: [
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/SENTRY_TRACES_SAMPLE_RATE=1\.0/))
      ).toBeInTheDocument();
    });
  });

  it('displays metrics code in verify section when metrics are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.METRICS],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
      )
    ).toBeInTheDocument();
  });

  it('does not display metrics code in verify section when metrics are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(
        textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
      )
    ).not.toBeInTheDocument();
  });
});
