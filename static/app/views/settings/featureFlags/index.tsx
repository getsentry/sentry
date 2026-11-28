import {Fragment} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {DisplayField} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {useFeatureFlagOnboarding} from 'sentry/components/events/featureFlags/onboarding/useFeatureFlagOnboarding';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

function OrganizationFeatureFlagsIndex() {
  const organization = useOrganization();
  const {activateSidebar} = useFeatureFlagOnboarding({projectPlatform: undefined});

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Feature Flags')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Feature Flags')}
        subtitle={tct(
          'Integrating Sentry with your feature flag provider enables Sentry to correlate feature flag changes with new error events and mark certain changes as suspicious. To learn more about our feature flag features, [link:read our docs].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/feature-flags/" />
            ),
          }
        )}
      />

      <Panel>
        <PanelHeader>{t('Features')}</PanelHeader>
        <PanelBody>
          <PanelItem>
            <DisplayField.Row
              label={<Text size="lg">{t('Evaluation Tracking')}</Text>}
              hintText={t(
                'Evaluation tracking enables Sentry to capture flag values on your error events. Flag evaluations will appear in the "Feature Flags" section of the Issue Details page.'
              )}
            >
              <Button
                aria-label={t('Set Up Evaluation Tracking')}
                onClick={mouseEvent => {
                  activateSidebar(mouseEvent);
                }}
              >
                {t('Set Up Project')}
              </Button>
            </DisplayField.Row>
          </PanelItem>
          <PanelItem>
            <DisplayField.Row
              label={<Text size="lg">{t('Change Tracking')}</Text>}
              hintText={t(
                'Change tracking enables Sentry to listen for additions, removals, and modifications to your feature flags.'
              )}
            >
              <LinkButton
                to={`/settings/${organization.slug}/feature-flags/change-tracking/`}
              >
                {t('Manage Providers')}
              </LinkButton>
            </DisplayField.Row>
          </PanelItem>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

export default function OrganizationFeatureFlagsIndexRoute() {
  return (
    <AnalyticsArea name="feature_flag_org_settings">
      <OrganizationFeatureFlagsIndex />
    </AnalyticsArea>
  );
}
