import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getManualInstallSnippet = (params: DocsParams) => `
plugins {
  id "com.android.application" // should be in the same module
  id "io.sentry.android.gradle" version "${getPackageVersion(
    params,
    'sentry.java.android.gradle-plugin',
    '5.9.0'
  )}"
}`;

export const profiling: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Android UI Profiling is available starting in SDK version [code:8.7.0].',
            {
              code: <code />,
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
              code: getManualInstallSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Version [versionPlugin] of the plugin will automatically add the Sentry Android SDK (version [versionSdk]) to your app.',
            {
              versionPlugin: (
                <code>
                  {getPackageVersion(
                    params,
                    'sentry.java.android.gradle-plugin',
                    '5.9.0'
                  )}
                </code>
              ),
              versionSdk: (
                <code>{getPackageVersion(params, 'sentry.java.android', '8.6.0')}</code>
              ),
            }
          ),
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
          text: tct('Set up profiling in your [code:AndroidManifest.xml] file.', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'XML',
              language: 'xml',
              filename: 'AndroidManifest.xml',
              code: `
<application>
  <meta-data
    android:name="io.sentry.dsn"
    android:value="${params.dsn.public}"
  />
  <meta-data
    android:name="io.sentry.traces.sample-rate"
    android:value="1.0"
  />${
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `
  <!-- Set sampling rate for profiling, adjust in production env - this is evaluated only once per session -->
  <!-- note: there is a known issue in the Android Runtime that can be triggered by Profiling in certain circumstances -->
  <!-- see https://docs.sentry.io/platforms/android/profiling/troubleshooting/ -->
  <meta-data
    android:name="io.sentry.traces.profiling.session-sample-rate"
    android:value="1.0"
  />
  <!-- Set profiling lifecycle, can be \`manual\` (controlled through \`Sentry.startProfiler()\` and \`Sentry.stopProfiler()\`) or \`trace\` (automatically starts and stop a profile whenever a sampled trace starts and finishes) -->
  <meta-data
    android:name="io.sentry.traces.profiling.lifecycle"
    android:value="trace"
  />
  <!-- Enable profiling on app start -->
  <meta-data
    android:name="io.sentry.traces.profiling.start-on-app-start"
    android:value="true"
  />`
      : `
  <!-- Set sampling rate for profiling, adjust in production env - this is relative to sampled transactions -->
  <!-- note: there is a known issue in the Android Runtime that can be triggered by Profiling in certain circumstances -->
  <!-- see https://docs.sentry.io/platforms/android/profiling/troubleshooting/ -->
  <meta-data
    android:name="io.sentry.traces.profiling.sample-rate"
    android:value="1.0"
  />
  <!-- Enable profiling on app start -->
  <meta-data
    android:name="io.sentry.traces.profiling.enable-app-start"
    android:value="true"
  />`
  }
</application>
`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/profiling/" />
              ),
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
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
};
