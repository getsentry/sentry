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
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
import (
  "fmt"
  "net/http"

  "github.com/getsentry/sentry-go"
  sentryhttp "github.com/getsentry/sentry-go/http"
)

// To initialize Sentry's handler, you need to initialize Sentry itself beforehand
if err := sentry.Init(sentry.ClientOptions{
  Dsn: "${params.dsn}",
  EnableTracing: true,
  // Set TracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production,
  TracesSampleRate: 1.0,
}); err != nil {
  fmt.Printf("Sentry initialization failed: %v\n", err)
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

const getBeforeSendSnippet = params => `
sentry.Init(sentry.ClientOptions{
  Dsn: "${params.dsn}",
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
      description: tct('Install our Go HTTP SDK using [code:go get]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/http',
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
                  '[sentryHttpCode:sentryhttp] accepts a struct of [optionsCode:Options] that allows you to configure how the handler will behave.',
                  {sentryHttpCode: <code />, optionsCode: <code />}
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
              "[sentryHttpCode:sentryhttp] attaches an instance of [sentryHubLink:*sentry.Hub] to the request's context, which makes it available throughout the rest of the request's lifetime. You can access it by using the [getHubFromContextCode:sentry.GetHubFromContext()] method on the request itself in any of your proceeding middleware and routes. And it should be used instead of the global [captureMessageCode:sentry.CaptureMessage], [captureExceptionCode:sentry.CaptureException], or any other calls, as it keeps the separation of data between the requests.",
              {
                sentryHttpCode: <code />,
                sentryHubLink: (
                  <ExternalLink href="https://godoc.org/github.com/getsentry/sentry-go#Hub" />
                ),
                getHubFromContextCode: <code />,
                captureMessageCode: <code />,
                captureExceptionCode: <code />,
              }
            )}
          </p>
          <AlertWithoutMarginBottom>
            {tct(
              "Keep in mind that [sentryHubCode:*sentry.Hub] won't be available in middleware attached before [sentryHttpCode:sentryhttp]!",
              {sentryHttpCode: <code />, sentryHubCode: <code />}
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

const docs: Docs = {
  onboarding,
};

export default docs;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;
