import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type BasePlatformOptions,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getMetricsCodeJava = () => `// Counter metric - track occurrences
Sentry.metrics().count("button_click", 1.0);

// Gauge metric - track a value that can go up and down
Sentry.metrics().gauge("queue_size", 42.0);

// Distribution metric - track a value distribution
Sentry.metrics().distribution("response_time", 150.0);`;

const getMetricsCodeKotlin = () => `// Counter metric - track occurrences
Sentry.metrics().count("button_click", 1.0)

// Gauge metric - track a value that can go up and down
Sentry.metrics().gauge("queue_size", 42.0)

// Distribution metric - track a value distribution
Sentry.metrics().distribution("response_time", 150.0)`;

export const getMetricsVerifyJavaSnippet = () => `import io.sentry.Sentry;

${getMetricsCodeJava()}`;

export const getMetricsVerifyKotlinSnippet = () => `import io.sentry.Sentry

${getMetricsCodeKotlin()}`;

export const metricsVerify = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>(
  params: DocsParams<PlatformOptions>
): ContentBlock => ({
  type: 'conditional',
  condition: params.isMetricsSelected,
  content: [
    {
      type: 'text',
      text: t(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      ),
    },
    {
      type: 'code',
      tabs: [
        {
          label: 'Java',
          language: 'java',
          code: getMetricsVerifyJavaSnippet(),
        },
        {
          label: 'Kotlin',
          language: 'kotlin',
          code: getMetricsVerifyKotlinSnippet(),
        },
      ],
    },
  ],
});

export const metrics = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>(): OnboardingConfig<PlatformOptions> => ({
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To start using metrics, make sure your Sentry Android SDK version is [version] or higher. If you're on an older version of the SDK, follow our [link:migration guide] to upgrade.",
            {
              version: (
                <code>{getPackageVersion(params, 'sentry.java.android', '8.30.0')}</code>
              ),
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/migration/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: () => [],
  verify: (params: DocsParams<PlatformOptions>) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your Sentry SDK configuration. You can emit metrics using the [code:Sentry.metrics()] API.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.Sentry;
import io.sentry.android.core.SentryAndroid;
import android.app.Application;

public class MyApplication extends Application {
  public void onCreate() {
    super.onCreate();
    SentryAndroid.init(this, options -> {
      options.setDsn("${params.dsn.public}");
    });
  }
}

${getMetricsCodeJava()}`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry
import io.sentry.android.core.SentryAndroid
import android.app.Application

class MyApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    SentryAndroid.init(this) { options ->
      options.dsn = "${params.dsn.public}"
    }
  }
}

${getMetricsCodeKotlin()}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
});
