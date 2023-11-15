import {CodeSnippetTab} from 'sentry/views/starfish/views/screens/tabbedCodeSnippets';

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
];

// const swiftSnippet = `// Call API when screen is fully drawn
// import Sentry

// SentrySDK.reportFullyDisplayed()`;

// const objCSnippet = `// Call API when screen is fully drawn
// @import Sentry;

// [SentrySDK reportFullyDisplayed];`;

// const javaSnippet = `// Call API when screen is fully drawn
// import io.sentry.Sentry;

// Sentry.reportFullyDisplayed();`;

// const kotlinSnippet = `// Call API when screen is fully drawn
// import io.sentry.Sentry

// Sentry.reportFullyDisplayed()`;

// export const REPORT_FULLY_DRAWN_CONTENT: CodeSnippetTab[] = [
//   {
//     code: swiftSnippet,
//     label: 'Swift',
//     language: 'swift',
//     value: 'swift',
//   },
//   {
//     code: objCSnippet,
//     label: 'Objective-C',
//     language: 'objectivec',
//     value: 'objective-c',
//   },
//   {
//     code: javaSnippet,
//     label: 'Java',
//     language: 'java',
//     value: 'java',
//   },
//   {
//     code: kotlinSnippet,
//     label: 'Kotlin',
//     language: 'kotlin',
//     value: 'kotlin',
//   },
// ];
