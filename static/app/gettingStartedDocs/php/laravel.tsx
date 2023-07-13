import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
  'This guide is for Laravel 8+. We also provide instructions for [otherVersionsLink:other versions] as well as [lumenSpecificLink:Lumen-specific instructions].',
  {
    otherVersionsLink: (
      <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/" />
    ),
    lumenSpecificLink: (
      <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/other-versions/lumen/" />
    ),
  }
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    configurations: [
      {
        description: (
          <p>
            {tct('Install the [code:sentry/sentry-laravel] package:', {
              code: <code />,
            })}
          </p>
        ),
        language: 'bash',
        code: `composer require sentry/sentry-laravel`,
      },
      {
        description: (
          <p>
            {tct(
              'Enable capturing unhandled exception to report to Sentry by making the following change to your [code:App/Exceptions/Handler.php]:',
              {
                code: <code />,
              }
            )}
          </p>
        ),
        language: 'php',
        code: `
public function register() {
  $this->reportable(function (Throwable $e) {
    if (app()->bound('sentry')) {
      app('sentry')->captureException($e);
    }
  });
}
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'Alternatively, you can configure Sentry in your [laravelLogChannelLink:Laravel Log Channel], allowing you to log [code:info] and [code:debug] as well.',
          {
            code: <code />,
            laravelLogChannelLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/usage/#log-channels" />
            ),
          }
        )}
      </p>
    ),
  },
  {
    type: StepType.CONFIGURE,
    configurations: [
      {
        description: t('Configure the Sentry DSN with this command:'),
        language: 'shell',
        code: `php artisan sentry:publish --dsn=${dsn}`,
      },
      {
        description: (
          <p>
            {tct(
              'It creates the config file ([code:config/sentry.php]) and adds the [code:DSN] to your ".env" file.',
              {code: <code />}
            )}
          </p>
        ),
        language: 'shell',
        code: `php artisan sentry:publish --dsn=${dsn}`,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    configurations: [
      {
        description: <h5>{t('Verify With Artisan')}</h5>,
        configurations: [
          {
            description: (
              <p>
                {tct(
                  'You can test your configuration using the provided [code:sentry:test] artisan command:',
                  {
                    code: <code />,
                  }
                )}
              </p>
            ),
            language: 'source-shell',
            code: 'php artisan sentry:test',
          },
        ],
      },
      {
        description: <h5>{t('Verify With Code')}</h5>,
        configurations: [
          {
            description: t(
              'You can verify that Sentry is capturing errors in your Laravel application by creating a route that will throw an exception:'
            ),
            language: 'php',
            code: `
Route::get('/debug-sentry', function () {
    throw new Exception('My first Sentry error!');
});
            `,
            additionalInfo: t(
              'Visiting this route will trigger an exception that will be captured by Sentry.'
            ),
          },
        ],
      },
    ],
  },
  {
    title: t('Performance Monitoring'),
    configurations: [
      {
        description: (
          <p>
            {tct(
              'Set [code:traces_sample_rate] in [code:config/sentry.php] or [code:SENTRY_TRACES_SAMPLE_RATE] in your ".env" to a value greater than "0.0". Setting a value greater than "0.0" will enable Performance Monitoring, "0" (the default) will disable Performance Monitoring.',
              {code: <code />}
            )}
          </p>
        ),
        language: 'shell',
        code: `
# Be sure to lower this value in production otherwise you could burn through your quota quickly.
SENTRY_TRACES_SAMPLE_RATE=1.0
        `,
        additionalInfo: (
          <Fragment>
            {t(
              'The example configuration above will transmit 100% of captured traces. Be sure to lower this value in production or you could use up your quota quickly.'
            )}
            <p>
              {tct(
                'You can also be more granular with the sample rate by using the traces_sampler option. Learn more in [usingSampleToFilterLink:Using Sampling to Filter Transaction Events].',
                {
                  usingSampleToFilterLink: (
                    <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/configuration/filtering/#using-sampling-to-filter-transaction-events" />
                  ),
                }
              )}
            </p>
            <p>
              {tct(
                "Performance data is transmitted using a new event type called 'transactions', which you can learn about in Distributed Tracing.",
                {
                  distributedTracingLink: (
                    <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/distributed-tracing/#traces-transactions-and-spans" />
                  ),
                }
              )}
            </p>
          </Fragment>
        ),
      },
    ],
  },
  {
    title: t('Local Development and Testing'),
    description: (
      <Fragment>
        {t(
          'When Sentry is installed in your application, it will also be active when you are developing or running tests.'
        )}
        <p>
          {tct(
            "You most likely don't want errors to be sent to Sentry when you are developing or running tests. To avoid this, set the DSN value to [code:null] to disable sending errors to Sentry.",
            {
              code: <code />,
            }
          )}
        </p>
        <p>
          {tct(
            'You can also do this by not defining [code:SENTRY_LARAVEL_DSN] in your [code:.env] or by defining it as [code:SENTRY_LARAVEL_DSN=null].',
            {code: <code />}
          )}
        </p>
        <p>
          {t(
            "If you do leave Sentry enabled when developing or running tests, it's possible for it to have a negative effect on the performance of your application or test suite."
          )}
        </p>
      </Fragment>
    ),
  },
];
// Configuration End

export function GettingStartedWithLaravel({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithLaravel;
