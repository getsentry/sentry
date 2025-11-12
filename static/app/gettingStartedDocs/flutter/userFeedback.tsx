import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

const getFeedbackConfigureSnippet = () => `
// The example uses the NavigatorState to present the widget. Adapt as needed to your navigation stack.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

...

await SentryFlutter.init((options) {
  options.beforeSend = (event, hint) async {
    // Filter here what kind of events you want users to give you feedback.

    final screenshot = await SentryFlutter.captureScreenshot();
    final context = navigatorKey.currentContext;
    if (context == null) return;
    if (context.mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SentryFeedbackWidget(
            associatedEventId: event.eventId,
            screenshot: screenshot,
          ),
          fullscreenDialog: true,
        ),
      );
    }
  };
});
`;

export const userFeedback: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Use the [code:SentryFeedbackWidget] to let users send feedback data to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            "The widget requests and collects the user's name, email address, and a description of what occurred. When an event identifier is provided, Sentry pairs the feedback with the original event, giving you additional insights into issues. Additionally, you can provide a screenshot that will be sent to Sentry. Learn more about how to enable screenshots in our [screenshotsDocs:screenshots documentation].",
            {
              screenshotsDocs: (
                <ExternalLink href="https://docs.sentry.io/platforms/dart/guides/flutter/enriching-events/screenshots/" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'One possible use for the [code:SentryFeedbackWidget] is to listen for specific Sentry events in the [code:beforeSend] callback and show the widget to users.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Dart',
              language: 'dart',
              code: getFeedbackConfigureSnippet(),
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};
