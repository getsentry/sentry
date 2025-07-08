import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs, {ModuleFormat} from './awslambda';

describe('awslambda onboarding docs', function () {
  describe('CJS: Lambda Layer', () => {
    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(docs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {name: /Upload Source Maps/i})
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher('NODE_OPTIONS="-r @sentry/aws-serverless/awslambda-auto"')
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

  describe('ESM: NPM Package', () => {
    let esmDocs: typeof docs;
    beforeAll(() => {
      esmDocs = {
        ...docs,
        platformOptions: {
          ...docs.platformOptions,
          moduleFormat: {
            ...docs.platformOptions!.moduleFormat,
            defaultValue: ModuleFormat.ESM,
          },
        },
      };
    });

    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(esmDocs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      const allMatches = screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/aws-serverless"/)
      );
      allMatches.forEach(match => {
        expect(match).toBeInTheDocument();
      });
    });

    it('enables profiling by setting profiling samplerates', () => {
      renderWithOnboardingLayout(esmDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
      });

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            /import { nodeProfilingIntegration } from "@sentry\/profiling-node"/
          )
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
      ).toBeInTheDocument();
    });

    it('continuous profiling', () => {
      const organization = OrganizationFixture({
        features: ['continuous-profiling'],
      });

      renderWithOnboardingLayout(
        esmDocs,
        {},
        {
          organization,
        }
      );

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            /import { nodeProfilingIntegration } from "@sentry\/profiling-node"/
          )
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(textWithMarkupMatcher(/profileLifecycle: 'trace'/))
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/profileSessionSampleRate: 1\.0/))
      ).toBeInTheDocument();
    });
  });
});
