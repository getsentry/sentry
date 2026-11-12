import {IconAdd} from '@sentry/icons/add';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {Feature} from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {getPaginationProps} from 'sentry/utils/pagination';
import {decodeScalar, decodeSorts, encodeSort} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGetSavedFormulas} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {TopBar} from 'sentry/views/navigation/topBar';

import {makeSavedFormulasPathname} from './pathnames';
import {SavedFormulasTable} from './savedFormulasTable';

export default function SavedFormulasView() {
  const organization = useOrganization();
  const location = useLocation();

  const cursor = decodeScalar(location.query.cursor);
  const sort: Sort = decodeSorts(location.query.sort)[0] ?? {field: 'name', kind: 'asc'};
  const {formulas, pageLinks, isPending, isError} = useGetSavedFormulas({
    cursor,
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
                <Pagination {...getPaginationProps(pageLinks)} />
              </Layout.Main>
            </Layout.Body>
          </Stack>
        </ErrorBoundary>
      </Feature>
    </SentryDocumentTitle>
  );
}
