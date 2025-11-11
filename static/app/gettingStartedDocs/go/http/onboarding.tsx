import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getConfigureSnippet = (params: DocsParams) => `
import (
  "fmt"
  "net/http"

  "github.com/getsentry/sentry-go"
  sentryhttp "github.com/getsentry/sentry-go/http"
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
  }${
    params.isLogsSelected
      ? `
  // Enable structured logs to Sentry
  EnableLogs: true,`
      : ''
  }
}); err != nil {
  fmt.Printf("Sentry initialization failed: %v\\n", err)
}

// Create an instance of sentryhttp
sentryHandler := sentryhttp.New(sentryhttp.Options{})

// Once it's done, you can set up routes and attach the handler as one of your middleware
http.Handle("/", sentryHandler.Handle(&handler{}))
http.HandleFunc("/foo", sentryHandler.HandleFunc(func(rw http.ResponseWriter, r *http.Request) {
  panic("y tho")
}))

fmt.Println("Listening and serving HTTP on :3000")

// And run it
if err := http.ListenAndServe(":3000", nil); err != nil {
  panic(err)
}`;

const getOptionsSnippet = () => `
// Whether Sentry should repanic after recovery, in most cases it should be set to true,
// and you should gracefully handle http responses.
Repanic bool
// Whether you want to block the request before moving forward with the response.
// Useful, when you want to restart the process after it panics.
WaitForDelivery bool
// Timeout for the event delivery requests.
Timeout time.Duration`;

const getUsageSnippet = () => `
type handler struct{}

func (h *handler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
  if hub := sentry.GetHubFromContext(r.Context()); hub != nil {
    hub.WithScope(func(scope *sentry.Scope) {
      scope.SetExtra("unwantedQuery", "someQueryDataMaybe")
      hub.CaptureMessage("User provided unwanted query string, but we recovered just fine")
    })
  }
  rw.WriteHeader(http.StatusOK)
}

func enhanceSentryEvent(handler http.HandlerFunc) http.HandlerFunc {
  return func(rw http.ResponseWriter, r *http.Request) {
    if hub := sentry.GetHubFromContext(r.Context()); hub != nil {
      hub.Scope().SetTag("someRandomTag", "maybeYouNeedIt")
    }
    handler(rw, r)
  }
}

// Later in the code

sentryHandler := sentryhttp.New(sentryhttp.Options{
  Repanic: true,
})

http.Handle("/", sentryHandler.Handle(&handler{}))
http.HandleFunc("/foo", sentryHandler.HandleFunc(
  enhanceSentryEvent(func(rw http.ResponseWriter, r *http.Request) {
    panic("y tho")
  }),
))

fmt.Println("Listening and serving HTTP on :3000")

if err := http.ListenAndServe(":3000", nil); err != nil {
  panic(err)
}`;

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

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install our Go HTTP SDK using [code:go get]:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/http',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Import and initialize the Sentry SDK early in your application's setup:"
          ),
        },
        {
          type: 'code',
          language: 'go',
          code: getConfigureSnippet(params),
        },
        {
          type: 'subheader',
          text: t('Options'),
        },
        {
          type: 'text',
          text: [
            tct(
              '[code:sentryhttp] accepts a struct of [code:Options] that allows you to configure how the handler will behave.',
              {code: <code />}
            ),
            t('Currently it respects 3 options:'),
          ],
        },
        {
          type: 'code',
          language: 'go',
          code: getOptionsSnippet(),
        },
      ],
    },
    {
      title: t('Usage'),
      content: [
        {
          type: 'text',
          text: tct(
            "[code:sentryhttp] attaches an instance of [sentryHubLink:*sentry.Hub] to the request's context, which makes it available throughout the rest of the request's lifetime. You can access it by using the [code:sentry.GetHubFromContext()] method on the request itself in any of your proceeding middleware and routes. And it should be used instead of the global [code:sentry.CaptureMessage], [code:sentry.CaptureException], or any other calls, as it keeps the separation of data between the requests.",
            {
              code: <code />,
              sentryHubLink: (
                <ExternalLink href="https://pkg.go.dev/github.com/getsentry/sentry-go#Hub" />
              ),
            }
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          showIcon: false,
          text: tct(
            "Keep in mind that [code:*sentry.Hub] won't be available in middleware attached before [code:sentryhttp]!",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'go',
          code: getUsageSnippet(),
        },
        {
          type: 'subheader',
          text: tct('Accessing Request in [beforeSendCode:BeforeSend] callback', {
            beforeSendCode: <code />,
          }),
        },
        {
          type: 'code',
          language: 'go',
          code: getBeforeSendSnippet(params),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: (params: DocsParams) => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/go/logs/#integrations',
      });
    }

    return steps;
  },
};
