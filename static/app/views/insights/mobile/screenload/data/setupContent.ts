import type {CodeSnippetTab} from 'sentry/views/insights/mobile/screenload/components/tabbedCodeSnippets';

const swiftSetupSnippet = `// Step 1 - Enable Time to Full Display
import Sentry

SentrySDK.start { options in
  options.dsn = "<my-dsn-key>"
  options.enableTimeToFullDisplayTracing = true
}

// Step 2 - Call API when screen is fully drawn
SentrySDK.reportFullyDisplayed()
`;

const kotlinSnippet = `<!--Step 1: Enable Time to Full Display in AndroidManifest.xml-->
<application>
    <meta-data android:name="io.sentry.traces.time-to-full-display.enable" android:value="true" />
</application>

// Step 2 - Call API when screen is fully drawn
import io.sentry.Sentry

Sentry.reportFullyDisplayed()
`;

const reactNativeSnippet = `// Step 1 - Use TimeToFullDisplay Component
import * as Sentry from '@sentry/react-native';

<Sentry.TimeToFullDisplay record={false}>
  <MyView />
</Sentry.TimeToFullDisplay>

// Step 2 - Set \`record={true}\` when screen is to be fully drawn
<Sentry.TimeToFullDisplay record={true} />
`;

export const SETUP_CONTENT: CodeSnippetTab[] = [
  {
    code: swiftSetupSnippet,
    label: 'Swift',
    language: 'swift',
    value: 'swift',
  },
  {
    code: kotlinSnippet,
    label: 'Kotlin',
    language: 'unknown',
    value: 'kotlin',
  },
  {
    code: reactNativeSnippet,
    label: 'React Native',
    language: 'jsx',
    value: 'react-native',
  },
];
