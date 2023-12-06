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
    description: (
      <p>
        {tct(
          "To use Sentry in your Ionic app, install the Sentry Capacitor SDK alongside the sibling Sentry SDK related to the Web framework you're using with Ionic. The supported siblings are: Angular [sentryAngularIvyCode:@sentry/angular-ivy], React [sentryReactCode:@sentry/react] and Vue [sentryVueCode:@sentry/vue].",
          {
            sentryAngularIvyCode: <code />,
            sentryReactCode: <code />,
            sentryVueCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        description: t(
          'Heres an example of installing Sentry Capacitor along with Sentry Angular:'
        ),
        code: 'npm install --save @sentry/capacitor @sentry/angular',
      },
      {
        language: 'bash',
        description: t('or'),
        code: 'yarn add @sentry/capacitor @sentry/angular',
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
          'The same installation process applies to the other siblings, all you need to do is to replace [code:@sentry/angular-ivy] by the desired sibling.',
          {code: <code />}
        )}
      </p>
    ),
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct('You must initialize the Sentry SDK as early as you can:', {code: <code />})}
      </p>
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
import * as Sentry from "@sentry/capacitor";
// The example is using Angular 12+. Import '@sentry/angular' for Angular 10 and 11. Import '@sentry/vue' or '@sentry/react' when using a Sibling different than Angular.
import * as SentrySibling from "@sentry/angular-ivy";

Sentry.init(
  {
    dsn: "${dsn}",
    // To set your release and dist versions
    release: "my-project-name@" + process.env.npm_package_version,
    dist: "1",
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production.
    tracesSampleRate: 1.0,
    integrations: [
      new SentrySibling.BrowserTracing({
        // Set "tracePropagationTargets" to control for which URLs distributed tracing should be enabled
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/yourserver\.io\/api/,
        ],
        routingInstrumentation: SentrySibling.routingInstrumentation,
      }),
    ],
  },
  // Forward the init method to the sibling Framework.
  SentrySibling.init
);
        `,
      },
      {
        language: 'javascript',
        description: (
          <p>
            {tct(
              "Additionally for Angular, you will also need to configure your root [code:app.module.ts] (same code doesn't apply to other siblings):",
              {
                code: <code />,
              }
            )}
          </p>
        ),
        code: `
@NgModule({
  providers: [
    {
      provide: ErrorHandler,
      // Attach the Sentry ErrorHandler
      useValue: SentrySibling.createErrorHandler(),
    },
    {
      provide: SentrySibling.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [SentrySibling.TraceService],
      multi: true,
    },
  ],
})
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

export function GettingStartedWithIonic({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithIonic;
