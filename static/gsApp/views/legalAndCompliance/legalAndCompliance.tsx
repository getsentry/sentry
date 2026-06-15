import {FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {
  getLocalityDataFromOrganization,
  shouldDisplayLocalities,
} from 'sentry/utils/cells';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DATA_STORAGE_DOCS_LINK} from 'sentry/views/organizationCreate';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {useSubscription} from 'getsentry/hooks/useSubscription';
import {GDPRPanel} from 'getsentry/views/legalAndCompliance/gdprPanel';
import {TermsAndConditions} from 'getsentry/views/legalAndCompliance/termsAndConditions';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

export default function LegalAndCompliance() {
  const organization = useOrganization();
  const subscription = useSubscription();

  const localityData = getLocalityDataFromOrganization(organization);

  if (!subscription) {
    return <LoadingIndicator />;
  }

  return (
    <SubscriptionPageContainer>
      <SentryDocumentTitle title={t('Legal & Compliance')} />
      <SettingsPageHeader title="Legal & Compliance" />
      {shouldDisplayLocalities() && localityData && (
        <FieldGroup title={t('General')}>
          <Flex direction="row" gap="xl" align="center" justify="between" flexGrow={1}>
            <Stack width="50%" gap="xs">
              <Text>{t('Data Storage Region')}</Text>
              <Text size="sm" variant="muted">
                {tct("Your organization's data storage location. [link:Learn More]", {
                  link: <ExternalLink href={DATA_STORAGE_DOCS_LINK} />,
                })}
              </Text>
            </Stack>
            <Container flexGrow={1}>
              <Text>{localityData.label}</Text>
            </Container>
          </Flex>
        </FieldGroup>
      )}
      <TermsAndConditions subscription={subscription} />
      <GDPRPanel subscription={subscription} />
    </SubscriptionPageContainer>
  );
}
