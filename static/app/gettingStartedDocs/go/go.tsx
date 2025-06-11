import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportGenericInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

export enum YesNo {
  YES = 'yes',
  NO = 'no',
}

const platformOptions = {
  logsBeta: {
    label: t('Logs Beta'),
    items: [
      {
        label: t('Yes'),
        value: YesNo.YES,
      },
      {
        label: t('No'),
        value: YesNo.NO,
      },
    ],
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getConfigureSnippet = (params: Params) => `
package main

import (
  "log"

  "github.com/getsentry/sentry-go"
)

func main() {
  err := sentry.Init(sentry.ClientOptions{
    Dsn: "${params.dsn.public}",${
      params.isPerformanceSelected
        ? `
    // Set TracesSampleRate to 1.0 to capture 100%
    // of transactions for tracing.
    // We recommend adjusting this value in production,
    TracesSampleRate: 1.0,`
        : ''
    }${
      params.platformOptions.logsBeta === YesNo.YES
        ? `
    // Enable Sentry logs beta feature
    EnableLogs: true,`
        : ''
    }
  })
  if err != nil {
    log.Fatalf("sentry.Init: %s", err)
  }
}`;

const getVerifySnippet = (params: Params) =>
  params.platformOptions.logsBeta === YesNo.YES ? `
package main

import (
  "log"
  "time"

  "github.com/getsentry/sentry-go"
)

func main() {
  err := sentry.Init(sentry.ClientOptions{
    Dsn: "${params.dsn.public}",${
      params.isPerformanceSelected
        ? `
    // Set TracesSampleRate to 1.0 to capture 100%
    // of transactions for tracing.
    // We recommend adjusting this value in production,
    TracesSampleRate: 1.0,`
        : ''
    }
    // Enable Sentry logs beta feature
    EnableLogs: true,
  })
  if err != nil {
    log.Fatalf("sentry.Init: %s", err)
  }
  // Flush buffered events before the program terminates.
  defer sentry.Flush(2 * time.Second)

  // Send logs using Sentry
  sentry.WithScope(func(scope *sentry.Scope) {
    scope.SetLevel(sentry.LevelInfo)
    sentry.CaptureMessage("This is an info log from Sentry")
  })

  sentry.CaptureMessage("It works!")
}` : `
package main

import (
  "log"
  "time"

  "github.com/getsentry/sentry-go"
)

func main() {
  err := sentry.Init(sentry.ClientOptions{
    Dsn: "${params.dsn.public}",${
      params.isPerformanceSelected
        ? `
    // Set TracesSampleRate to 1.0 to capture 100%
    // of transactions for tracing.
    // We recommend adjusting this value in production,
    TracesSampleRate: 1.0,`
        : ''
    }
  })
  if err != nil {
    log.Fatalf("sentry.Init: %s", err)
  }
  // Flush buffered events before the program terminates.
  defer sentry.Flush(2 * time.Second)

  sentry.CaptureMessage("It works!")
}`;

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Go SDK using [code:go get]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Import and initialize the Sentry SDK early in your application's setup:"
      ),
      configurations: [
        {
          language: 'go',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: params.platformOptions.logsBeta === YesNo.YES
        ? t('The quickest way to verify Sentry in your Go program is to capture logs and a message:')
        : t('The quickest way to verify Sentry in your Go program is to capture a message:'),
      configurations: [
        {
          language: 'go',
          code: getVerifySnippet(params),
        },
      ],
      ...(params.platformOptions.logsBeta === YesNo.YES && {
        additionalInfo: t(
          "With logs enabled, you can now send structured logs to Sentry using the logger APIs. These logs will be automatically linked to errors and traces for better debugging context."
        ),
      }),
    },
  ],
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportGenericInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/go/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  platformOptions,
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;
