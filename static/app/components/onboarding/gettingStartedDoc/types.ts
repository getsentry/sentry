import type React from 'react';

import type {Client} from 'sentry/api';
import type {AlertProps} from 'sentry/components/core/alert';
import type {CodeSnippetTab} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import type {ReleaseRegistrySdk} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project, ProjectKey} from 'sentry/types/project';

type GeneratorFunction<T, Params> = (params: Params) => T;
type WithGeneratorProperties<T extends Record<string, any>, Params> = {
  [key in keyof T]: GeneratorFunction<T[key], Params>;
};

type BaseBlock<T extends string> = {
  type: T;
};

type AlertBlock = BaseBlock<'alert'> & {
  alertType: AlertProps['type'];
  text: React.ReactNode;
  type: 'alert';
  icon?: AlertProps['icon'];
  showIcon?: AlertProps['showIcon'];
  system?: AlertProps['system'];
  trailingItems?: AlertProps['trailingItems'];
};

type TextBlock = BaseBlock<'text'> & {
  /**
   * Only meant for text or return values of translation functions (t, tct, tn).
   *
   * **Do not** use this with custom react elements but instead use the `custom` block type.
   */
  text: React.ReactNode;
};

type CodeTabWithoutValue = Omit<CodeSnippetTab, 'value'>;

type SingleCodeBlock = BaseBlock<'code'> & Omit<CodeTabWithoutValue, 'label'>;
type MultipleCodeBlock = BaseBlock<'code'> & {
  tabs: CodeTabWithoutValue[];
};

type CodeBlock = SingleCodeBlock | MultipleCodeBlock;

type CustomBlock = BaseBlock<'custom'> & {
  content: React.ReactNode;
};

type ConditionalBlock = BaseBlock<'conditional'> & {
  condition: boolean;
  content: ContentBlock[];
};

export type ContentBlock =
  | TextBlock
  | CodeBlock
  | CustomBlock
  | AlertBlock
  | ConditionalBlock;

export type Configuration = {
  /**
   * Additional information to be displayed below the code snippet
   */
  additionalInfo?: React.ReactNode;
  /**
   * The code snippet to display
   */
  code?: string | CodeSnippetTab[];
  /**
   * Nested configurations provide a convenient way to accommodate diverse layout styles, like the Spring Boot configuration.
   * @deprecated Use `content` instead
   */
  configurations?: Configuration[];

  /**
   * A brief description of the configuration
   */
  description?: React.ReactNode;
  /**
   * The language of the code to be rendered (python, javascript, etc)
   */
  language?: string;
  /**
   * A callback to be invoked when the configuration is copied to the clipboard
   */
  onCopy?: () => void;
  /**
   * A callback to be invoked when the configuration is selected and copied to the clipboard
   */
  onSelectAndCopy?: () => void;
  /**
   * Whether or not the configuration or parts of it are currently being loaded
   */
  partialLoading?: boolean;
};

export enum StepType {
  INSTALL = 'install',
  CONFIGURE = 'configure',
  VERIFY = 'verify',
}

interface BaseStepProps {
  /**
   * Additional information to be displayed below the configurations
   * @deprecated Use `content` instead
   */
  additionalInfo?: React.ReactNode;
  /**
   * Content that goes directly above the code snippet
   * @deprecated Use `content` instead
   */
  codeHeader?: React.ReactNode;
  /**
   * Whether the step instructions are collapsible
   */
  collapsible?: boolean;
  /**
   * An array of configurations to be displayed
   * @deprecated Use `content` instead
   */
  configurations?: Configuration[];
  /**
   * The content blocks to display
   */
  content?: ContentBlock[];
  /**
   * A brief description of the step
   * @deprecated Use `content` instead
   */
  description?: React.ReactNode | React.ReactNode[];
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
}

export interface DocsParams<
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
> {
  api: Client;
  dsn: ProjectKey['dsn'];
  isFeedbackSelected: boolean;
  isPerformanceSelected: boolean;
  isProfilingSelected: boolean;
  isReplaySelected: boolean;
  isSelfHosted: boolean;
  organization: Organization;
  platformKey: PlatformKey;
  platformOptions: SelectedPlatformOptions<PlatformOptions>;
  projectId: Project['id'];
  projectKeyId: ProjectKey['id'];
  projectSlug: Project['slug'];
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
