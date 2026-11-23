import {useQueryStates} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';

import {Feature} from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreSavedQueryBreadcrumbs} from 'sentry/views/explore/components/exploreSavedQueryBreadcrumbs';
import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';
import {TopBar} from 'sentry/views/navigation/topBar';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

import {MultiQueryModeContent} from './content';

export default function MultiQueryMode() {
  const organization = useOrganization();
  const [{title, id}] = useQueryStates({title: parseAsScalar, id: parseAsScalar});

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
          <TopBar.Slot
            name="breadcrumbs"
            title={{type: 'page-title', label: title || t('Compare Queries')}}
            items={[
              {
                type: 'link',
                label: t('Traces'),
                to: makeTracesPathname({organization, path: '/'}),
              },
            ]}
          />
        )}
        <Stack flex={1}>
          <MultiQueryModeContent />
        </Stack>
      </SentryDocumentTitle>
    </Feature>
  );
}
