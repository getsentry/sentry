import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export default function altCrashReportCallout() {
  return (
    <Alert.Container>
      <Alert type="info" showIcon>
        {tct(
          `Want to add an embeddable, JavaScript-based, crash-report modal to your website instead? [link:Read the docs] to learn how.`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/user-feedback/#crash-report-modal" />
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
