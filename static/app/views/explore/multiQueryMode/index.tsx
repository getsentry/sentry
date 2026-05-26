import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {SavedQueryEditMenu} from 'sentry/views/explore/savedQueryEditMenu';
import {StarSavedQueryButton} from 'sentry/views/explore/starSavedQueryButton';
import {TopBar} from 'sentry/views/navigation/topBar';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export default function MultiQueryMode() {
  const location = useLocation();
  const organization = useOrganization();
  const title = decodeScalar(location.query.title);

  const id = decodeScalar(location.query.id);
  const {data: savedQuery} = useGetSavedQuery(id);

  return (
    <Feature
      features="visibility-explore-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Compare Queries')} orgSlug={organization.slug}>
        <TopBar.Slot name="title">
          <Breadcrumbs
            crumbs={[
              {label: t('Explore')},
              {
                label: t('Traces'),
                to: makeTracesPathname({organization, path: '/'}),
              },
              {label: title ? title : t('Compare Queries')},
            ]}
          />
        </TopBar.Slot>
        <TopBar.Slot name="actions">
          <StarSavedQueryButton />
          {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
        </TopBar.Slot>
        <TopBar.Slot name="feedback">
          <FeedbackButton
            aria-label={t('Give Feedback')}
            tooltipProps={{title: t('Give Feedback')}}
          >
            {null}
          </FeedbackButton>
        </TopBar.Slot>
        <Stack flex={1}>
          <MultiQueryModeContent />
        </Stack>
      </SentryDocumentTitle>
    </Feature>
  );
}
