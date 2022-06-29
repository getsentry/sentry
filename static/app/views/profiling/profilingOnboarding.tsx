import {useEffect} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types/organization';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

interface Props {
  onDismissClick: () => void;
  onDoneClick: () => void;
  organization: Organization;
}

export default function ProfilingOnboarding(props: Props) {
  useEffect(() => {
    trackAdvancedAnalyticsEvent('profiling_views.onboarding', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={props.organization.slug}>
      <StyledPageContent>
        <Main>
          <Layout.Title>
            {t('Welcome to Sentry Profiling')}
            <FeatureBadge type="alpha" />
          </Layout.Title>
          <Content>
            <p>
              {t(`With Sentry Profiling you can instrument your native iOS and Android apps to
        collect profiles for your transactions. This gives you a unique insight into what
        is on the execution stack at any point during the duration of the transaction.
        Data is collected in production, on real devices with real users.`)}
            </p>

            <Alert>
              {t(
                `Profiling is only possible with sentry-cocoa and sentry-java SDKs right now. We don’t support React Native or Flutter yet.`
              )}
            </Alert>

            <ProfilingSteps>
              <li>
                {t(
                  'Make sure your SDKs are upgraded to 6.0.0 (sentry-java) or 7.13.0 (sentry-cocoa).'
                )}
              </li>
              <li>
                {t(
                  `Setup performance transactions in your app if you haven’t already → `
                )}{' '}
                <ExternalLink
                  href="https://docs.sentry.io/product/performance/"
                  rel="noreferrer"
                >
                  {t('https://docs.sentry.io/product/performance/')}
                </ExternalLink>
              </li>
              <li>
                {t('Enable profiling in your app by configuring the SDKs like below:')}
                <pre>
                  <code>{`SentrySDK.start { options in
    options.dsn = "..."
    options.tracesSampleRate = 1.0 // Make sure transactions are enabled
    options.enableProfiling = true
}`}</code>
                </pre>

                <pre>
                  <code>
                    {`<application>
  <meta-data android:name="io.sentry.dsn" android:value="..." />
  <meta-data android:name="io.sentry.traces.sample-rate" android:value="1.0" />
  <meta-data android:name="io.sentry.traces.profiling.enable" android:value="true" />
</application>`}
                  </code>
                </pre>
              </li>
              <li>
                {t('Join the discussion on')}{' '}
                <ExternalLink href="https://discord.gg/FvQuVVCD">Discord</ExternalLink>{' '}
                {t(
                  'or email us at profiling@sentry.io with any questions or if you need help setting it all up! There’s also a page with some more details and a troubleshooting section at'
                )}{' '}
                <ExternalLink
                  href="https://sentry.notion.site/Profiling-Beta-Testing-Instructions-413ecdd9fcb34b3a8b57806280bf2ecb"
                  rel="noreferrer"
                >
                  our notion page
                </ExternalLink>
              </li>

              <Actions>
                <Button priority="primary" onClick={props.onDoneClick}>
                  {t("I'm done")}
                </Button>
                <Button onClick={props.onDismissClick}>{t('Dismiss')}</Button>
              </Actions>
            </ProfilingSteps>
          </Content>
        </Main>
      </StyledPageContent>
    </SentryDocumentTitle>
  );
}

const Content = styled('div')`
  margin: ${space(2)} 0 ${space(3)} 0;
`;

const Actions = styled('div')`
  margin-top: ${space(4)};

  > button:not(:first-child) {
    margin-left: ${space(2)};
  }
`;

const StyledPageContent = styled(PageContent)`
  background-color: ${p => p.theme.background};
`;

const ProfilingSteps = styled('ol')`
  li {
    margin-bottom: ${space(1)};
  }
`;

const Main = styled('div')`
  width: 100%;

  pre:not(:last-child) {
    margin-top: ${space(2)};
  }
`;
