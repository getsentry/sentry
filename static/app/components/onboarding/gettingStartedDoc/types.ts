import type React from 'react';

import type {Client} from 'sentry/api';
import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import type {ReleaseRegistrySdk} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project, ProjectKey} from 'sentry/types/project';

export type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';

type GeneratorFunction<T, Params> = (params: Params) => T;
type WithGeneratorProperties<T extends Record<string, any>, Params> = {
  [key in keyof T]: GeneratorFunction<T[key], Params>;
};

export enum StepType {
  INSTALL = 'install',
  CONFIGURE = 'configure',
  VERIFY = 'verify',
}

interface BaseStepProps {
  /**
   * The content blocks to display
   */
  content: ContentBlock[];
  /**
   * Whether the step instructions are collapsible
   */
  collapsible?: boolean;
  /**
   * Fired when the optional toggle is clicked.
   * Useful for when we want to fire analytics events.
   */
  onOptionalToggleClick?: (showOptionalConfig: boolean) => void;
  /**
   * Additional items to be displayed to the right of the step title, e.g. a button to copy the configuration to the clipboard.
   */
  trailingItems?: React.ReactNode;
}

interface StepPropsWithTitle extends BaseStepProps {
  title: string;
  type?: undefined;
}

interface StepPropsWithoutTitle extends BaseStepProps {
  type: StepType;
  title?: undefined;
}

export type OnboardingStep = StepPropsWithTitle | StepPropsWithoutTitle;

export interface PlatformOption<Value extends string = string> {
  /**
   * Array of items for the option. Each one representing a selectable value.
   */
  items: Array<{
    label: string;
    value: Value;
  }>;
  /**
   * The name of the option
   */
  label: string;
  /**
   * The default value to be used on initial render
   */
  defaultValue?: string;
}

export type BasePlatformOptions = Record<string, PlatformOption<string>>;

export type SelectedPlatformOptions<
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
> = {
  [key in keyof PlatformOptions]: PlatformOptions[key]['items'][number]['value'];
};

export enum DocsPageLocation {
  PROFILING_PAGE = 1,
}

export enum ProductSolution {
  ERROR_MONITORING = 'error-monitoring',
  PERFORMANCE_MONITORING = 'performance-monitoring',
  SESSION_REPLAY = 'session-replay',
  PROFILING = 'profiling',
  LOGS = 'logs',
  METRICS = 'metrics',
}

export interface DocsParams<
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
> {
  api: Client;
  dsn: ProjectKey['dsn'];
  isFeedbackSelected: boolean;
  isLogsSelected: boolean;
  isMetricsSelected: boolean;
  isPerformanceSelected: boolean;
  isProfilingSelected: boolean;
  isReplaySelected: boolean;
  isSelfHosted: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  platformOptions: SelectedPlatformOptions<PlatformOptions>;
  project: Project;
  projectKeyId: ProjectKey['id'];
  sourcePackageRegistries: {isLoading: boolean; data?: ReleaseRegistrySdk};
  urlPrefix: string;
  /**
   * The page where the docs are being displayed
   */
  docsLocation?: DocsPageLocation;
  featureFlagOptions?: {
    integration: string;
  };
  feedbackOptions?: {
    email?: boolean;
    name?: boolean;
    screenshot?: boolean;
  };
  newOrg?: boolean;
  profilingOptions?: {
    defaultProfilingMode?: 'transaction' | 'continuous';
  };
  replayOptions?: {
    block?: boolean;
    mask?: boolean;
  };
}

interface NextStep {
  description: string;
  link: string;
  name: string;
}

export interface OnboardingConfig<
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
> extends WithGeneratorProperties<
    {
      configure: OnboardingStep[];
      install: OnboardingStep[];
      verify: OnboardingStep[];
      introduction?: React.ReactNode | React.ReactNode[];
      nextSteps?: Array<NextStep | null>;
      onPageLoad?: () => void;
      onPlatformOptionsChange?: (
        platformOptions: SelectedPlatformOptions<PlatformOptions>
      ) => void;
      onProductSelectionChange?: (params: {
        previousProducts: ProductSolution[];
        products: ProductSolution[];
      }) => void;
      onProductSelectionLoad?: (products: ProductSolution[]) => void;
    },
    DocsParams<PlatformOptions>
  > {}

export interface Docs<PlatformOptions extends BasePlatformOptions = BasePlatformOptions> {
  onboarding: OnboardingConfig<PlatformOptions>;
  agentMonitoringOnboarding?: OnboardingConfig<PlatformOptions>;
  crashReportOnboarding?: OnboardingConfig<PlatformOptions>;
  featureFlagOnboarding?: OnboardingConfig<PlatformOptions>;
  feedbackOnboardingCrashApi?: OnboardingConfig<PlatformOptions>;
  feedbackOnboardingJsLoader?: OnboardingConfig<PlatformOptions>;
  feedbackOnboardingNpm?: OnboardingConfig<PlatformOptions>;
  logsOnboarding?: OnboardingConfig<PlatformOptions>;
  mcpOnboarding?: OnboardingConfig<PlatformOptions>;
  metricsOnboarding?: OnboardingConfig<PlatformOptions>;
  performanceOnboarding?: OnboardingConfig<PlatformOptions>;
  platformOptions?: PlatformOptions;
  profilingOnboarding?: OnboardingConfig<PlatformOptions>;
  replayOnboarding?: OnboardingConfig<PlatformOptions>;
  replayOnboardingJsLoader?: OnboardingConfig<PlatformOptions>;
}

export type ConfigType =
  | 'onboarding'
  | 'feedbackOnboardingNpm'
  | 'feedbackOnboardingCrashApi'
  | 'feedbackOnboardingJsLoader'
  | 'crashReportOnboarding'
  | 'replayOnboarding'
  | 'replayOnboardingJsLoader'
  | 'featureFlagOnboarding';
