import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const logs: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To start using logs, make sure your Sentry Android SDK version is at least 8.12.0. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade. The easiest way to update the SDK is through the Sentry Android Gradle plugin in your app module [code:build.gradle] file.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/migration/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Groovy',
              language: 'groovy',
              filename: 'app/build.gradle',
              code: `plugins {
  id "com.android.application"
  id "io.sentry.android.gradle" version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '5.9.0'
  )}"
}`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              filename: 'app/build.gradle.kts',
              code: `plugins {
  id("com.android.application")
  id("io.sentry.android.gradle") version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '5.9.0'
  )}"
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you have the SDK installed without the Sentry Gradle Plugin, you can update the version directly in the [code:build.gradle] through:',
            {code: <code />}
          ),
        },

        {
          type: 'code',
          tabs: [
            {
              label: 'Groovy',
              value: 'groovy',
              language: 'groovy',
              filename: 'app/build.gradle',
              code: `dependencies {
  implementation 'io.sentry:sentry-android:${getPackageVersion(
    params,
    'sentry.java.android',
    '8.12.0'
  )}'
}`,
            },
            {
              label: 'Kotlin',
              value: 'kotlin',
              language: 'kotlin',
              filename: 'app/build.gradle.kts',
              code: `dependencies {
  implementation("io.sentry:sentry-android:${getPackageVersion(
    params,
    'sentry.java.android',
    '8.12.0'
  )}")
}`,
            },
          ],
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
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:logs.enabled] option set to [code:true].',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'XML',
              language: 'xml',
              filename: 'AndroidManifest.xml',
              code: `<meta-data android:name="io.sentry.logs.enabled" android:value="true" />`,
            },
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.SentryLevel;
import io.sentry.android.core.SentryAndroid;
import android.app.Application;

public class MyApplication extends Application {
  public void onCreate() {
    super.onCreate();
    SentryAndroid.init(this, options -> {
      options.setDsn("${params.dsn.public}");
      options.getLogs().setEnabled(true);
    });
  }
}`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.SentryLevel;
import io.sentry.android.core.SentryAndroid;
import android.app.Application;

class MyApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    SentryAndroid.init(this, options -> {
      options.setDsn("${params.dsn.public}")
      options.getLogs().setEnabled(true)
    })
  }
}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You can also configure [link:logging integrations] to automatically capture logs from your application from libraries like [code:Timber] or [code:Logcat].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/logs/#integrations" />
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
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.Sentry;

Sentry.logger().info("A simple log message");
Sentry.logger().error("A %s log message", "formatted");`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry

Sentry.logger().info("A simple log message")
Sentry.logger().error("A %s log message", "formatted")`,
            },
          ],
        },
      ],
    },
  ],
};
