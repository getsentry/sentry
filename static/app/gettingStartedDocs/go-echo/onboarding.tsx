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
  sentryecho "github.com/getsentry/sentry-go/echo"
  "github.com/labstack/echo/v4"
  "github.com/labstack/echo/v4/middleware"
)

// To initialize Sentry's handler, you need to initialize Sentry itself beforehand
if err := sentry.Init(sentry.ClientOptions{
  Dsn: "${params.dsn.public}",${
    params.isLogsSelected
      ? `
  // Enable structured logs to Sentry
  EnableLogs: true,`
      : ''
  }${
    params.isPerformanceSelected
      ? `
  // Set TracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production,
  TracesSampleRate: 1.0,`
      : ''
  }
}); err != nil {
  fmt.Printf("Sentry initialization failed: %v\\n", err)
}

// Then create your app
app := echo.New()

app.Use(middleware.Logger())
app.Use(middleware.Recover())

// Once it's done, you can attach the handler as one of your middleware
app.Use(sentryecho.New(sentryecho.Options{}))

// Set up routes
app.GET("/", func(ctx echo.Context) error {
  return ctx.String(http.StatusOK, "Hello, World!")
})

// And run it
app.Logger.Fatal(app.Start(":3000"))`;

const getOptionsSnippet = () => `
// Repanic configures whether Sentry should repanic after recovery, in most cases it should be set to true,
// as echo includes its own Recover middleware that handles http responses.
Repanic bool
// WaitForDelivery configures whether you want to block the request before moving forward with the response.
// Because Echo's "Recover" handler doesn't restart the application,
// it's safe to either skip this option or set it to "false".
WaitForDelivery bool
// Timeout for the event delivery requests.
Timeout time.Duration`;

const getUsageSnippet = () => `
app := echo.New()

app.Use(middleware.Logger())
app.Use(middleware.Recover())

app.Use(sentryecho.New(sentryecho.Options{
  Repanic: true,
}))

app.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
  return func(ctx echo.Context) error {
    if hub := sentryecho.GetHubFromContext(ctx); hub != nil {
      hub.Scope().SetTag("someRandomTag", "maybeYouNeedIt")
    }
    return next(ctx)
  }
})

app.GET("/", func(ctx echo.Context) error {
  if hub := sentryecho.GetHubFromContext(ctx); hub != nil {
    hub.WithScope(func(scope *sentry.Scope) {
      scope.SetExtra("unwantedQuery", "someQueryDataMaybe")
      hub.CaptureMessage("User provided unwanted query string, but we recovered just fine")
    })
  }
  return ctx.String(http.StatusOK, "Hello, World!")
})

app.GET("/foo", func(ctx echo.Context) error {
  // sentryecho handler will catch it just fine. Also, because we attached "someRandomTag"
  // in the middleware before, it will be sent through as well
  panic("y tho")
})

app.Logger.Fatal(app.Start(":3000"))`;

const getBeforeSendSnippet = (params: DocsParams) => `
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
          text: tct('Install our Go Echo SDK using [code:go get]:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/echo',
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
              '[code:sentryecho] accepts a struct of [code:Options] that allows you to configure how the handler will behave.',
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
        {
          type: 'subheader',
          text: t('Usage'),
        },
        {
          type: 'text',
          text: tct(
            "[code:sentryecho] attaches an instance of [sentryHubLink:*sentry.Hub] to the [code:echo.Context], which makes it available throughout the rest of the request's lifetime. You can access it by using the [code:sentryecho.GetHubFromContext()] method on the context itself in any of your proceeding middleware and routes. And it should be used instead of the global [code:sentry.CaptureMessage], [code:sentry.CaptureException] or any other calls, as it keeps the separation of data between the requests.",
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
            "Keep in mind that [code:*sentry.Hub] won't be available in middleware attached before [code:sentryecho]!",
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
