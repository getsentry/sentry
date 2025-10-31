import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type BasePlatformOptions,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logs = <PlatformOptions extends BasePlatformOptions = BasePlatformOptions>({
  docsPlatform,
}: {
  docsPlatform: string;
}): OnboardingConfig<PlatformOptions> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our Go SDK using [code:go get]. The minimum version of the SDK that supports logs is [code:0.33.0].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go',
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
          code: `package main

import (
  "github.com/getsentry/sentry-go"
)

func main() {
  err := sentry.Init(sentry.ClientOptions{
    Dsn: "${params.dsn.public}",
    EnableLogs: true,
  })
  if err != nil {
    log.Fatalf("sentry.Init: %s", err)
  }
  // Flush buffered events before the program terminates.
  // Set the timeout to the maximum duration the program can afford to wait.
  defer sentry.Flush(2 * time.Second)
}`,
        },
        {
          type: 'text',
          text: tct(
            'You can also add [link:logging integrations] to automatically capture logs from your application from libraries like [code:slog] or [code:logrus].',
            {
              link: (
                <ExternalLink
                  href={
                    docsPlatform === 'go'
                      ? `https://docs.sentry.io/platforms/go/logs/#integrations`
                      : `https://docs.sentry.io/platforms/go/guides/${docsPlatform}/logs/#integrations`
                  }
                />
              ),
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          language: 'go',
          code: `// The SentryLogger requires context, to link logs with the appropriate traces. You can either create a new logger
// by providing the context, or use WithCtx() to pass the context inline.
ctx := context.Background()
logger := sentry.NewLogger(ctx)

// Or inline using WithCtx()
newCtx := context.Background()
// WithCtx() does not modify the original context attached on the logger.
logger.Info().WithCtx(newCtx).Emit("context passed")

// You can use the logger like [fmt.Print]
logger.Info().Emit("Hello ", "world!")
// Or like [fmt.Printf]
logger.Info().Emitf("Hello %v!", "world")`,
        },
      ],
    },
  ],
});
