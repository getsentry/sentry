import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Sentry captures data by using an SDK within your application’s runtime. If you are using Expo, see [expoLink:How to Add Sentry to Your Expo Project]. This SDK works for both managed and bare projects.',
          {expoLink: <ExternalLink href="https://docs.expo.dev/guides/using-sentry/" />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        description: <div>{tct('Run [code:@sentry/wizard]:', {code: <code />})}</div>,
        code: 'npx @sentry/wizard@latest -s -i reactNative',
        additionalInfo: (
          <Fragment>
            <p>
              {tct(
                '[wizardLink:Sentry Wizard] will patch your project accordingly, though you can [setupManuallyLink:setup manually] if you prefer.',
                {
                  wizardLink: (
                    <ExternalLink href="https://github.com/getsentry/sentry-wizard" />
                  ),
                  setupManuallyLink: (
                    <ExternalLink href="https://docs.sentry.io/platforms/react-native/manual-setup/manual-setup/" />
                  ),
                }
              )}
            </p>
            <List symbol="bullet">
              <ListItem>
                {t(
                  'iOS Specifics: When you use Xcode, you can hook directly into the build process to upload debug symbols and source maps.'
                )}
              </ListItem>
              <ListItem>
                {tct(
                  "Android Specifics: We hook into Gradle for the source map build process. When you run [gradLewCode:./gradlew] assembleRelease, source maps are automatically built and uploaded to Sentry. If you have enabled Gradle's [orgGradleCode:org.gradle.configureondemand] feature, you'll need a clean build, or you'll need to disable this feature to upload the source map on every build by setting [orgGradleCodeConfigureCode:org.gradle.configureondemand=false] or remove it.",
                  {
                    gradLewCode: <code />,
                    orgGradleCode: <code />,
                    orgGradleCodeConfigureCode: <code />,
                  }
                )}
              </ListItem>
            </List>
          </Fragment>
        ),
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    configurations: [
      {
        language: 'javascript',
        code: `
        import * as Sentry from "@sentry/react-native";

        Sentry.init({
          dsn: "${dsn}",
          // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
          // We recommend adjusting this value in production.
          tracesSampleRate: 1.0,
        });
        `,
        additionalInfo: (
          <p>
            {tct('The "sentry-wizard" will try to add it to your [code:App.tsx]', {
              code: <code />,
            })}
          </p>
        ),
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              'Wrap your app with Sentry to automatically instrument it with [touchEventTrakingLink:touch event tracking] and [automaticPerformanceMonitoringLink:automatic performance monitoring]:',
              {
                touchEventTrakingLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/touchevents/" />
                ),
                automaticPerformanceMonitoringLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/performance/instrumentation/automatic-instrumentation/" />
                ),
              }
            )}
          </p>
        ),
        code: 'export default Sentry.wrap(App);',
        additionalInfo: t(
          'You do not need to do this for Sentry to work or if your app does not have a single parent "App" component.'
        ),
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'Then create an intentional error, so you can test that everything is working:'
    ),
    configurations: [
      {
        language: 'javascript',
        code: "throw new Error('My first Sentry error!');",
      },
      {
        language: 'javascript',
        description: t('Or, try a native crash with:'),
        code: 'Sentry.nativeCrash();',
        additionalInfo: (
          <Fragment>
            {t(
              "If you're new to Sentry, use the email alert to access your account and complete a product tour."
            )}
            {t(
              "If you're an existing user and have disabled alerts, you won't receive this email."
            )}
          </Fragment>
        ),
      },
    ],
  },
  {
    title: t('Performance'),
    description: (
      <Fragment>
        {t(
          'Sentry can measure the performance of your app automatically when instrumented with the following routers:'
        )}
        <List symbol="bullet">
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/react-native/performance/instrumentation/automatic-instrumentation/#react-navigation">
              {t('React Navigation')}
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/react-native/performance/instrumentation/automatic-instrumentation/#react-navigation-v4">
              {t('React Navigation V4 and prior')}
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://docs.sentry.io/platforms/react-native/performance/instrumentation/automatic-instrumentation/#react-native-navigation">
              {t('React Native Navigation')}
            </ExternalLink>
          </ListItem>
        </List>
        {t('Additionally, you can create transactions and spans programatically:')}
      </Fragment>
    ),
    configurations: [
      {
        description: t('For example:'),
        language: 'javascript',
        code: `
        // Let's say this function is invoked when a user clicks on the checkout button of your shop
        shopCheckout() {
          // This will create a new Transaction for you
          const transaction = Sentry.startTransaction({ name: "shopCheckout" });
          // Set transaction on scope to associate with errors and get included span instrumentation
          // If there's currently an unfinished transaction, it may be dropped
          Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));

          // Assume this function makes an xhr/fetch call
          const result = validateShoppingCartOnServer();

          const span = transaction.startChild({
            data: {
              result
            },
            op: 'task',
            description: "processing shopping cart result",
          });
          try {
            processAndValidateShoppingCart(result);
            span.setStatus(SpanStatus.Ok);
          } catch (err) {
            span.setStatus(SpanStatus.UnknownError);
            throw err;
          } finally {
            span.finish();
            transaction.finish();
          }
        }
        `,
        additionalInfo: (
          <p>
            {tct(
              'For more information, please refer to the [docLink: Sentry React Native documentation].',
              {
                docLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/performance/instrumentation/" />
                ),
              }
            )}
          </p>
        ),
      },
    ],
  },
  {
    title: t('Debug Symbols'),
    description: (
      <Fragment>
        {t(
          'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and triage issues faster.'
        )}
        <p>
          {tct(
            "Complete stack traces will be shown for React Native Javascript errors by default using Sentry's [automaticSourceMapsUploadLink:automatic source maps upload]. To set up manual source maps upload follow [guideLink:this guide].",
            {
              automaticSourceMapsUploadLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
              ),
              guideLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
              ),
            }
          )}
        </p>
        <p>
          {tct(
            "You'll also need to upload [debugSymbolsLink:Debug Symbols] generated by the native iOS and Android tooling for native crashes.",
            {
              debugSymbolsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/" />
              ),
            }
          )}
        </p>
      </Fragment>
    ),
  },
  {
    title: t('Source Context'),
    description: (
      <Fragment>
        <p>
          {tct(
            "If Sentry has access to your application's source code, it can show snippets of code [italic:(source context)] around the location of stack frames, which helps to quickly pinpoint problematic code.",
            {
              italic: <i />,
            }
          )}
        </p>
        <p>
          {tct(
            'Source Context will be shown for React Native Javascript error by default if source maps are uploaded. To set up source maps upload, follow the [sourceMapsGuideLink:Source Maps guide].',
            {
              sourceMapsGuideLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
              ),
            }
          )}
        </p>
        <p>
          {tct(
            "To enable source context for native errors, you'll need to upload native debug symbols to Sentry by following the instructions at [uploadWithGradleLink:Uploading Source Code Context With Sentry Gradle Plugin] and Uploading Source Context With Xcode.",
            {
              uploadWithGradleLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/#uploading-source-context-with-sentry-gradle-plugin" />
              ),
              uploadWithXCodeLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/#uploading-source-context-with-xcode" />
              ),
            }
          )}
        </p>
      </Fragment>
    ),
  },
];
// Configuration End

export function GettingStartedWithReactNative({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithReactNative;
