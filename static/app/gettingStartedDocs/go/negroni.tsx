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
  sentrynegroni "github.com/getsentry/sentry-go/negroni"
  "github.com/urfave/negroni"
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

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Go Negroni SDK using [code:go get]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go/negroni',
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
                  '[sentryNegroniCode:sentrynegroni] accepts a struct of [optionsCode:Options] that allows you to configure how the handler will behave.',
                  {sentryNegroniCode: <code />, optionsCode: <code />}
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
              "[sentryNegroniCode:sentrynegroni] attaches an instance of [sentryHubLink:*sentry.Hub] to the request's context, which makes it available throughout the rest of the request's lifetime. You can access it by using the [getHubFromContextCode:sentry.GetHubFromContext()] method on the request itself in any of your proceeding middleware and routes. And it should be used instead of the global [captureMessageCode:sentry.CaptureMessage], [captureExceptionCode:sentry.CaptureException], or any other calls, as it keeps the separation of data between the requests.",
              {
                sentryNegroniCode: <code />,
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
              "Keep in mind that [sentryHubCode:*sentry.Hub] won't be available in middleware attached before [sentryNegroniCode:sentrynegroni]!",
              {sentryNegroniCode: <code />, sentryHubCode: <code />}
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
    {
      title: t("Using Negroni's 'panicHandlerFuncCode' Option"),
      description: (
        <Fragment>
          <p>
            {tct(
              "Negroni provides an option called [panicHandlerFuncCode:PanicHandlerFunc], which lets you 'plug-in' to its default [recoveryCode:Recovery] middleware.",
              {
                panicHandlerFuncCode: <code />,
                recoveryCode: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              "[sentrynegroniCode:sentrynegroni] exports a very barebones implementation, which utilizes it, so if you don't need anything else than just reporting panics to Sentry, you can use it instead, as it's just one line of code!",
              {
                sentrynegroniCode: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              'You can still use [beforeSendCode:BeforeSend] and event processors to modify data before delivering it to Sentry, using this method as well.',
              {
                beforeSendCode: <code />,
              }
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'go',
          code: getPanicHandlerSnippet(),
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
