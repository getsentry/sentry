import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreSavedQueryBreadcrumbs} from 'sentry/views/explore/components/exploreSavedQueryBreadcrumbs';
import {MultiQueryModeContent} from 'sentry/views/explore/multiQueryMode/content';
import {TopBar} from 'sentry/views/navigation/topBar';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export default function MultiQueryMode() {
  const location = useLocation();
  const organization = useOrganization();
  const title = decodeScalar(location.query.title);

  const id = decodeScalar(location.query.id);

  return (
    <Feature
      features="visibility-explore-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Compare Queries')} orgSlug={organization.slug}>
        {defined(id) && title ? (
          <ExploreSavedQueryBreadcrumbs
            surface="compare"
            savedQueryId={id}
            title={title}
          />
        ) : (
          <Fragment>
            <TopBar.Slot name="breadcrumbs">
              <BreadcrumbList
                items={[
                  {
                    type: 'link',
                    label: t('Traces'),
                    to: makeTracesPathname({organization, path: '/'}),
                  },
                ]}
              />
            </TopBar.Slot>
            <TopBar.Slot name="title">
              <BreadcrumbList.Title
                item={{type: 'page-title', label: title || t('Compare Queries')}}
              />
            </TopBar.Slot>
          </Fragment>
        )}
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
