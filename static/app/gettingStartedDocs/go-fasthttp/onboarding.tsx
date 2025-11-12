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
  sentryfasthttp "github.com/getsentry/sentry-go/fasthttp"
)

// To initialize Sentry's handler, you need to initialize Sentry itself beforehand
if err := sentry.Init(sentry.ClientOptions{
  Dsn: "${params.dsn.public}",${
    params.isPerformanceSelected
      ? `
  EnableTracing: true,
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

// Create an instance of sentryfasthttp
sentryHandler := sentryfasthttp.New(sentryfasthttp.Options{})

// After creating the instance, you can attach the handler as one of your middleware
fastHTTPHandler := sentryHandler.Handle(func(ctx *fasthttp.RequestCtx) {
  panic("y tho")
})

fmt.Println("Listening and serving HTTP on :3000")

// And run it
if err := fasthttp.ListenAndServe(":3000", fastHTTPHandler); err != nil {
  panic(err)
}`;

const getOptionsSnippet = () => `
// Repanic configures whether Sentry should repanic after recovery, in most cases, it defaults to false,
// as fasthttp doesn't include its own Recovery handler.
Repanic bool
// WaitForDelivery configures whether you want to block the request before moving forward with the response.
// Because fasthttp doesn't include its own "Recovery" handler, it will restart the application,
// and the event won't be delivered otherwise.
WaitForDelivery bool
// Timeout for the event delivery requests.
Timeout time.Duration`;

const getUsageSnippet = () => `
func enhanceSentryEvent(handler fasthttp.RequestHandler) fasthttp.RequestHandler {
  return func(ctx *fasthttp.RequestCtx) {
    if hub := sentryfasthttp.GetHubFromContext(ctx); hub != nil {
      hub.Scope().SetTag("someRandomTag", "maybeYouNeedIt")
    }
    handler(ctx)
  }
}

// Later in the code
sentryHandler := sentryfasthttp.New(sentryfasthttp.Options{
  Repanic: true,
  WaitForDelivery: true,
})

defaultHandler := func(ctx *fasthttp.RequestCtx) {
  if hub := sentryfasthttp.GetHubFromContext(ctx); hub != nil {
    hub.WithScope(func(scope *sentry.Scope) {
      scope.SetExtra("unwantedQuery", "someQueryDataMaybe")
      hub.CaptureMessage("User provided unwanted query string, but we recovered just fine")
    })
  }
  ctx.SetStatusCode(fasthttp.StatusOK)
}

fooHandler := enhanceSentryEvent(func(ctx *fasthttp.RequestCtx) {
  panic("y tho")
})

fastHTTPHandler := func(ctx *fasthttp.RequestCtx) {
  switch string(ctx.Path()) {
  case "/foo":
    fooHandler(ctx)
  default:
    defaultHandler(ctx)
  }
}

fmt.Println("Listening and serving HTTP on :3000")

if err := fasthttp.ListenAndServe(":3000", sentryHandler.Handle(fastHTTPHandler)); err != nil {
  panic(err)
}`;

const getBeforeSendSnippet = (params: DocsParams) => `
sentry.Init(sentry.ClientOptions{
  Dsn: "${params.dsn.public}",
  BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
    if hint.Context != nil {
      if ctx, ok := hint.Context.Value(sentry.RequestContextKey).(*fasthttp.RequestCtx); ok {
        // You have access to the original Context if it panicked
        fmt.Println(string(ctx.Request.Host()))
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
          text: tct('Install our Go FastHTTP SDK using [code:go get]:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/fasthttp',
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
              '[code:sentryfasthttp] accepts a struct of [code:Options] that allows you to configure how the handler will behave.',
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
            "[code:sentryfasthttp] attaches an instance of [sentryHubLink:*sentry.Hub] to the request's context, which makes it available throughout the rest of the request's lifetime. You can access it by using the [code:sentryfasthttp.GetHubFromContext()] method on the context itself in any of your proceeding middleware and routes. And it should be used instead of the global [code:sentry.CaptureMessage], [code:sentry.CaptureException], or any other calls, as it keeps the separation of data between the requests.",
            {
              sentryHubLink: (
                <ExternalLink href="https://pkg.go.dev/github.com/getsentry/sentry-go#Hub" />
              ),
              code: <code />,
            }
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          showIcon: false,
          text: tct(
            "Keep in mind that [code:*sentry.Hub] won't be available in middleware attached before [code:sentryfasthttp]!",
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
