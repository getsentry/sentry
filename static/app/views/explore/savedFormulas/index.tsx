import {IconAdd} from '@sentry/icons/add';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGetSavedFormulas} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {FormulaBuilder} from 'sentry/views/explore/savedFormulas/formulaBuilder';
import {
  NEW_FORMULA,
  useFormulaBuilderUrl,
} from 'sentry/views/explore/savedFormulas/formulaBuilderUrl';
import {SavedFormulasTable} from 'sentry/views/explore/savedFormulas/savedFormulasTable';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function SavedFormulasView() {
  const organization = useOrganization();
  const location = useLocation();

  const navigate = useNavigate();
  const makeBuilderUrl = useFormulaBuilderUrl();

  const cursor = decodeScalar(location.query.cursor);
  const editing = decodeScalar(location.query.formula);
  const {formulas, pageLinks, isPending, isError} = useGetSavedFormulas({cursor});

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
                    to={makeBuilderUrl(NEW_FORMULA)}
                  >
                    {t('Create Formula')}
                  </LinkButton>
                </Flex>
                <SavedFormulasTable
                  formulas={formulas}
                  isPending={isPending}
                  isError={isError}
                />
                <Pagination pageLinks={pageLinks} />
              </Layout.Main>
            </Layout.Body>
            {editing ? (
              <FormulaBuilder
                key={editing}
                formula={formulas?.find(formula => formula.id === editing)}
                onClose={() =>
                  navigate({
                    pathname: location.pathname,
                    query: {...location.query, formula: undefined},
                  })
                }
              />
            ) : null}
          </Stack>
        </ErrorBoundary>
      </Feature>
    </SentryDocumentTitle>
  );
}
