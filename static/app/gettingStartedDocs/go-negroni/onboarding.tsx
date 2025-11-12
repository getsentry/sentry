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
  sentrynegroni "github.com/getsentry/sentry-go/negroni"
  "github.com/urfave/negroni"
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

// Then create your app
app := negroni.Classic()

// Once it's done, you can attach the handler as one of your middleware
app.Use(sentrynegroni.New(sentrynegroni.Options{}))

// Set up routes
mux := http.NewServeMux()

mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "Hello world!")
})

app.UseHandler(mux)

// And run it
http.ListenAndServe(":3000", app)`;

const getOptionsSnippet = () => `
// Whether Sentry should repanic after recovery, in most cases it should be set to true,
// as negroni.Classic includes its own Recovery middleware that handles http responses.
Repanic bool
// Whether you want to block the request before moving forward with the response.
// Because Negroni's default "Recovery" handler doesn't restart the application,
// it's safe to either skip this option or set it to "false".
WaitForDelivery bool
// Timeout for the event delivery requests.
Timeout time.Duration`;

const getUsageSnippet = () => `
app := negroni.Classic()

app.Use(sentrynegroni.New(sentrynegroni.Options{
  Repanic: true,
}))

app.Use(negroni.HandlerFunc(func(rw http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
  hub := sentry.GetHubFromContext(r.Context())
  hub.Scope().SetTag("someRandomTag", "maybeYouNeedIt")
  next(rw, r)
}))

mux := http.NewServeMux()

mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
  hub := sentry.GetHubFromContext(r.Context())
  hub.WithScope(func(scope *sentry.Scope) {
    scope.SetExtra("unwantedQuery", "someQueryDataMaybe")
    hub.CaptureMessage("User provided unwanted query string, but we recovered just fine")
  })
  rw.WriteHeader(http.StatusOK)
})

mux.HandleFunc("/foo", func(rw http.ResponseWriter, r *http.Request) {
  // sentrynagroni handler will catch it just fine. Also, because we attached "someRandomTag"
  // in the middleware before, it will be sent through as well
  panic("y tho")
})

app.UseHandler(mux)

http.ListenAndServe(":3000", app)`;

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

const getPanicHandlerSnippet = () => `
app := negroni.New()

recovery := negroni.NewRecovery()
recovery.PanicHandlerFunc = sentrynegroni.PanicHandlerFunc

app.Use(recovery)

mux := http.NewServeMux()
mux.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
  panic("y tho")
})

app.UseHandler(mux)

http.ListenAndServe(":3000", app)`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install our Go Negroni SDK using [code:go get]:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/negroni',
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
              '[code:sentrynegroni] accepts a struct of [code:Options] that allows you to configure how the handler will behave.',
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
            "[code:sentrynegroni] attaches an instance of [sentryHubLink:*sentry.Hub] to the request's context, which makes it available throughout the rest of the request's lifetime. You can access it by using the [code:sentry.GetHubFromContext()] method on the request itself in any of your proceeding middleware and routes. And it should be used instead of the global [code:sentry.CaptureMessage], [code:sentry.CaptureException], or any other calls, as it keeps the separation of data between the requests.",
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
            "Keep in mind that [code:*sentry.Hub] won't be available in middleware attached before [code:sentrynegroni]!",
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
    {
      title: t("Using Negroni's 'panicHandlerFuncCode' Option"),
      content: [
        {
          type: 'text',
          text: tct(
            "Negroni provides an option called [code:PanicHandlerFunc], which lets you 'plug-in' to its default [code:Recovery] middleware.",
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            "[sentrynegroniCode:sentrynegroni] exports a very barebones implementation, which utilizes it, so if you don't need anything else than just reporting panics to Sentry, you can use it instead, as it's just one line of code!",
            {
              sentrynegroniCode: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'You can still use [beforeSendCode:BeforeSend] and event processors to modify data before delivering it to Sentry, using this method as well.',
            {
              beforeSendCode: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'go',
          code: getPanicHandlerSnippet(),
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
