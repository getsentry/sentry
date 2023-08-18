import {Fragment} from 'react';

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
    description: t(
      'Install the Sentry Capacitor SDK alongside the sibling Sentry Angular SDK:'
    ),
    configurations: [
      {
        language: 'bash',
        code: `
# npm
npm install --save @sentry/capacitor @sentry/angular-ivy

# yarn
yarn add @sentry/capacitor @sentry/angular @sentry/tracing --exact
        `,
      },
      {
        language: 'bash',
        description: t(
          "Or install the standalone Sentry Capacitor SDK if you don't use Ionic/Angular:"
        ),
        code: `
# npm
npm install --save @sentry/capacitor @sentry/tracing

# yarn
yarn add @sentry/capacitor
        `,
      },
      {
        description: (
          <Fragment>
            <h5>{t('Capacitor 2 - Android')}</h5>
            {t('This step is not needed if you are using Capacitor 3')}
            <p>
              {tct(
                'Then, add the [sentryCapacitorCode:SentryCapacitor] plugin class inside the [onCreateCode:onCreate] method of your [mainActivityCode:MainActivity] file.',
                {
                  sentryCapacitorCode: <code />,
                  onCreateCode: <code />,
                  mainActivityCode: <code />,
                }
              )}
            </p>
          </Fragment>
        ),
        configurations: [
          {
            description: <strong>Java</strong>,
            language: 'java',
            code: `
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import io.sentry.capacitor.SentryCapacitor;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Initializes the Bridge
    this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
      add(SentryCapacitor.class);
    }});
  }
}
            `,
          },
          {
            description: <strong>Kotlin</strong>,
            language: 'kotlin',
            code: `
import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.getcapacitor.Plugin
import io.sentry.capacitor.SentryCapacitor

class MainActivity : BridgeActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Initializes the Bridge
    this.init(
      savedInstanceState,
      listOf<Class<out Plugin>>(SentryCapacitor::class.java)
    )
  }
}
            `,
          },
        ],
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'The version of the sibling SDK must match with the version referred by Sentry Capacitor. To check which version of the sibling SDK is installed, use the following command: [code:npm info @sentry/capacitor peerDependencies]',
          {code: <code />}
        )}
      </p>
    ),
  },
  {
    type: StepType.CONFIGURE,
    description: t('You must initialize the Sentry SDK as early as you can:'),
    configurations: [
      {
        description: t('With Ionic/Angular:'),
        language: 'typescript',
        code: `
  // app.module.ts
  import * as Sentry from '@sentry/capacitor';
  // Use "@sentry/angular-ivy" for Angular 12+ or "@sentry/angular" for Angular 10 or 11
  import * as SentryAngular from '@sentry/angular-ivy';


  Sentry.init(
    {
      dsn: '${dsn}',
      // To set your release and dist versions
      release: 'my-project-name@' + process.env.npm_package_version,
      dist: '1',
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production.
      tracesSampleRate: 1.0,
      integrations: [
        new SentryAngular.BrowserTracing({
          // Set "tracePropagationTargets" to control for which URLs distributed tracing should be enabled
          tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
          routingInstrumentation: SentryAngular.routingInstrumentation,
        }),
      ]
    },
    // Forward the init method from @sentry/angular
    SentryAngular.init
  );

  @NgModule({
    providers: [
      {
        provide: ErrorHandler,
        // Attach the Sentry ErrorHandler
        useValue: SentryAngular.createErrorHandler(),
      },
      {
        provide: SentryAngular.TraceService,
        deps: [Router],
      },
      {
        provide: APP_INITIALIZER,
        useFactory: () => () => {},
        deps: [SentryAngular.TraceService],
        multi: true,
      },
    ],
  })
  `,
      },
      {
        description: t('Standalone:'),
        language: 'javascript',
        code: `
// App.js
import * as Sentry from "@sentry/capacitor";

Sentry.init({
  dsn: "${dsn}",

  // Set your release version, such as 'getsentry@1.0.0'
  release: "my-project-name@<release-name>",
  // Set your dist version, such as "1"
  dist: "<dist>",
});
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'This snippet includes an intentional error, so you can test that everything is working as soon as you set it up:'
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
import * as Sentry from "@sentry/capacitor";

Sentry.captureException("Test Captured Exception");
        `,
      },
      {
        language: 'javascript',
        description: t('You can also throw an error anywhere in your application:'),
        code: `
// Must be thrown after Sentry.init is called to be captured.
throw new Error("Test Thrown Error");
        `,
      },
      {
        language: 'javascript',
        description: t('Or trigger a native crash:'),
        code: `
import * as Sentry from "@sentry/capacitor";

Sentry.nativeCrash();
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithCapacitor({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithCapacitor;
