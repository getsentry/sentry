import {Fragment} from 'react';
import styled from '@emotion/styled';

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

const getBeforeSendSnippet = (params: any) => `
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

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Go FastHTTP SDK using [code:go get]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/fasthttp',
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
                  '[code:sentryfasthttp] accepts a struct of [code:Options] that allows you to configure how the handler will behave.',
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
              "[code:sentryfasthttp] attaches an instance of [sentryHubLink:*sentry.Hub] to the request's context, which makes it available throughout the rest of the request's lifetime. You can access it by using the [code:sentryfasthttp.GetHubFromContext()] method on the context itself in any of your proceeding middleware and routes. And it should be used instead of the global [code:sentry.CaptureMessage], [code:sentry.CaptureException], or any other calls, as it keeps the separation of data between the requests.",
              {
                sentryHubLink: (
                  <ExternalLink href="https://pkg.go.dev/github.com/getsentry/sentry-go#Hub" />
                ),
                code: <code />,
              }
            )}
          </p>
          <AlertWithoutMarginBottom type="info">
            {tct(
              "Keep in mind that [code:*sentry.Hub] won't be available in middleware attached before [code:sentryfasthttp]!",
              {code: <code />}
            )}
          </AlertWithoutMarginBottom>
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
        link: 'https://docs.sentry.io/platforms/go/guides/fasthttp/user-feedback/configuration/#crash-report-modal',
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

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;
