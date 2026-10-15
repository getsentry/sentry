import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function SavedFormulasView() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Saved Formulas')} orgSlug={organization.slug}>
      <Feature
        features="organizations:explore-saved-formulas"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <ErrorBoundary>
          <Stack flex={1}>
            <TopBar.Slot
              name="breadcrumbs"
              title={{type: 'page-title', label: t('Saved Formulas')}}
            />
            <TopBar.Slot name="feedback">
              <FeedbackButton
                aria-label={t('Give Feedback')}
                tooltipProps={{title: t('Give Feedback')}}
              >
                {null}
              </FeedbackButton>
            </TopBar.Slot>

            <Layout.Body>
              <Layout.Main width="full">{null}</Layout.Main>
            </Layout.Body>
          </Stack>
        </ErrorBoundary>
      </Feature>
    </SentryDocumentTitle>
  );
}
