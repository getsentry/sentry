import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
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

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
import (
  "fmt"

  "github.com/getsentry/sentry-go"
  sentrymartini "github.com/getsentry/sentry-go/martini"
  "github.com/go-martini/martini"
)

// To initialize Sentry's handler, you need to initialize Sentry itself beforehand
if err := sentry.Init(sentry.ClientOptions{
  Dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  // Set TracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production,
  TracesSampleRate: 1.0,`
      : ''
  }
); err != nil {
  fmt.Printf("Sentry initialization failed: %v\\n", err)
}

// Then create your app
app := martini.Classic()

// Once it's done, you can attach the handler as one of your middleware
app.Use(sentrymartini.New(sentrymartini.Options{}))

// Set up routes
app.Get("/", func() string {
  return "Hello world!"
})

// And run it
app.Run()`;

const getOptionsSnippet = () => `
// Whether Sentry should repanic after recovery, in most cases it should be set to true,
// as martini.Classic includes its own Recovery middleware that handles http responses.
Repanic bool
// Whether you want to block the request before moving forward with the response.
// Because Martini's default "Recovery" handler doesn't restart the application,
// it's safe to either skip this option or set it to "false".
WaitForDelivery bool
// Timeout for the event delivery requests.
Timeout time.Duration`;

const getUsageSnippet = () => `
app := martini.Classic()

app.Use(sentrymartini.New(sentrymartini.Options{
  Repanic: true,
}))

app.Use(func(rw http.ResponseWriter, r *http.Request, c martini.Context, hub *sentry.Hub) {
  hub.Scope().SetTag("someRandomTag", "maybeYouNeedIt")
})

app.Get("/", func(rw http.ResponseWriter, r *http.Request, hub *sentry.Hub) {
  if someCondition {
    hub.WithScope(func (scope *sentry.Scope) {
      scope.SetExtra("unwantedQuery", rw.URL.RawQuery)
      hub.CaptureMessage("User provided unwanted query string, but we recovered just fine")
    })
  }
  rw.WriteHeader(http.StatusOK)
})

app.Get("/foo", func() string {
  // sentrymartini handler will catch it just fine. Also, because we attached "someRandomTag"
  // in the middleware before, it will be sent through as well
  panic("y tho")
})

app.Run()`;

const getBeforeSendSnippet = (params: any) => `
sentry.Init(sentry.ClientOptions{
  Dsn: "${params.dsn.public}",
  BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
    if hint.Context != nil {
      if req, ok := hint.Context.Value(sentry.RequestContextKey).(*http.Request); ok {
        // You have access to the original Request here
      }
    }

    return event
  },
})`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Go Martini SDK using [code:go get]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/martini',
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
        {
          description: (
            <Fragment>
              <strong>{t('Options')}</strong>
              <p>
                {tct(
                  '[code:sentrymartini] accepts a struct of [code:Options] that allows you to configure how the handler will behave.',
                  {code: <code />}
                )}
              </p>
              {t('Currently it respects 3 options:')}
            </Fragment>
          ),
          language: 'go',
          code: getOptionsSnippet(),
        },
      ],
    },
    {
      title: t('Usage'),
      description: (
        <Fragment>
          <p>
            {tct(
              "[code:sentrymartini] maps an instance of [sentryHubLink:*sentry.Hub] as one of the services available throughout the rest of the request's lifetime. You can access it by providing a hub [code:*sentry.Hub] parameter in any of your proceeding middleware and routes. And it should be used instead of the global [code:sentry.CaptureMessage], [code:sentry.CaptureException], or any other calls, as it keeps the separation of data between the requests.",
              {
                code: <code />,
                sentryHubLink: (
                  <ExternalLink href="https://pkg.go.dev/github.com/getsentry/sentry-go#Hub" />
                ),
              }
            )}
          </p>
          <Alert type="info">
            {tct(
              "Keep in mind that [code:*sentry.Hub] won't be available in middleware attached before [code:sentrymartini]!",
              {code: <code />}
            )}
          </Alert>
        </Fragment>
      ),
      configurations: [
        {
          language: 'go',
          code: getUsageSnippet(),
        },
        {
          description: (
            <strong>
              {tct('Accessing Request in [beforeSendCode:BeforeSend] callback', {
                beforeSendCode: <code />,
              })}
            </strong>
          ),
          language: 'go',
          code: getBeforeSendSnippet(params),
        },
      ],
    },
  ],
  verify: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportGenericInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/go/guides/martini/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;
