import {IconAdd} from '@sentry/icons/add';
import {useQueryStates} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {Feature} from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {encodeSort} from 'sentry/utils/queryString';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGetSavedFormulas} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';
import {TopBar} from 'sentry/views/navigation/topBar';

import {makeSavedFormulasPathname} from './pathnames';
import {SavedFormulasTable} from './savedFormulasTable';

export default function SavedFormulasView() {
  const organization = useOrganization();
  const [{cursor, sort: sortParam}] = useQueryStates({
    cursor: parseAsScalar,
    sort: parseAsSort,
  });

  const sort: Sort = sortParam ?? {field: 'name', kind: 'asc'};
  const {formulas, pageLinks, isPending, isError} = useGetSavedFormulas({
    cursor: cursor ?? undefined,
    sortBy: encodeSort(sort),
  });

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
              <Layout.Main width="full">
                <Flex justify="end" paddingBottom="md">
                  <LinkButton
                    variant="primary"
                    icon={<IconAdd />}
                    to={makeSavedFormulasPathname({organization, path: '/new/'})}
                  >
                    {t('Create Formula')}
                  </LinkButton>
                </Flex>
                <SavedFormulasTable
                  formulas={formulas}
                  isPending={isPending}
                  isError={isError}
                  sort={sort}
                />
                <Pagination pageLinks={pageLinks} />
              </Layout.Main>
            </Layout.Body>
          </Stack>
        </ErrorBoundary>
      </Feature>
    </SentryDocumentTitle>
  );
}
