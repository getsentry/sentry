import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To start using logs, install the latest version of the Sentry Laravel SDK. Logs are supported in version [code:4.15.0] and above of the SDK.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry-laravel',
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To configure Sentry as a log channel, add the following config to the [code:channels] section in [code:config/logging.php]. If this file does not exist, run [code:php artisan config:publish logging] to publish it.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'php',
              language: 'php',
              filename: 'config/logging.php',
              code: `'channels' => [
    // ...
    'sentry_logs' => [
        'driver' => 'sentry_logs',
        // The minimum logging level at which this handler will be triggered
        // Available levels: debug, info, notice, warning, error, critical, alert, emergency
        'level' => env('LOG_LEVEL', 'info'), // defaults to \`debug\` if not set
    ],
],`,
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'After you configured the Sentry log channel, you can configure your app to both log to a log file and to Sentry by modifying the log stack:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'bash',
              language: 'bash',
              filename: '.env',
              code: `# ...
LOG_CHANNEL=stack
LOG_STACK=single,sentry_logs
# ...`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You will also need to configure the Sentry Laravel SDK to enable the logging integration. You can do this by updating your [code:.env] file to include the following:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'bash',
              language: 'bash',
              filename: '.env',
              code: `# ...
SENTRY_ENABLE_LOGS=true
# ...`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Also make sure your [code:config/sentry.php] file is up to date. You can find the latest version on [externalLink:GitHub].',
            {
              code: <code />,
              externalLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-laravel/blob/master/config/sentry.php" />
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
            "Once you have configured Sentry as a log channel, you can use Laravel's built-in logging functionality to send logs to Sentry:"
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `use Illuminate\\Support\\Facades\\Log;

// Log to all channels in the stack (including Sentry)
Log::info('This is an info message');
Log::warning('User {id} failed to login.', ['id' => $user->id]);
Log::error('This is an error message');

// Log directly to the Sentry channel
Log::channel('sentry_logs')->error('This will only go to Sentry');`,
        },
      ],
    },
  ],
};
