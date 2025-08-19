import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import NotFound from 'sentry/components/errors/notFound';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import AssertionBaseForm from 'sentry/components/replays/assertions/assertionBaseForm';
import AssertionCreateEditForm from 'sentry/components/replays/assertions/assertionCreateEditForm';
import useAssertionPageCrumbs from 'sentry/components/replays/assertions/assertionPageCrumbs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useQuery} from 'sentry/utils/queryClient';
import AssertionDatabase from 'sentry/utils/replays/assertions/database';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

export default function ReplayAssertionDetails() {
  const organization = useOrganization();
  const {assertionId} = useParams<{assertionId: string}>();

  const {
    data: assertion,
    isPending,
    error,
  } = useQuery<AssertionFlow | undefined, Error, AssertionFlow>({
    queryKey: ['assertion', assertionId],
    queryFn: () => {
      const found = Array.from(AssertionDatabase.flows).find(
        flow => flow.id === assertionId
      );
      if (!found) {
        throw new Error(`Assertion with id ${assertionId} not found`);
      }
      return found;
    },
  });

  const crumbs = useAssertionPageCrumbs({label: assertionId});

  return (
    <SentryDocumentTitle
      title={t('Replay Flows - %s', assertionId)}
      orgSlug={organization.slug}
    >
      <FullViewport style={{height: '100vh'}}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} style={{padding: 0}} />
            <Flex gap="lg" align="center">
              <Layout.Title style={{width: 'auto'}}>
                {t('Assertion')}
                <PageHeadingQuestionTooltip
                  title={t('Assert that users are doing what you expect them to do.')}
                  docsUrl="https://docs.sentry.io/product/session-replay/"
                />
              </Layout.Title>
              <AssertionBaseForm disabled />
            </Flex>
          </Layout.HeaderContent>
          {assertion ? (
            <Layout.HeaderActions>
              <Flex gap="md">
                <Button priority="primary">Update</Button>
              </Flex>
            </Layout.HeaderActions>
          ) : null}
        </Layout.Header>
        <Flex
          background="primary"
          direction="column"
          flex="1"
          gap="lg"
          height="100%"
          minHeight="0"
          padding="lg 3xl"
        >
          {isPending ? (
            <LoadingIndicator />
          ) : error ? (
            <NotFound />
          ) : assertion ? (
            <AssertionCreateEditForm
              assertion={assertion}
              setAssertion={value => {
                // TODO: Implement mutation (update)
                // eslint-disable-next-line no-console
                console.log('setAssertion', value);
              }}
            />
          ) : (
            <NotFound />
          )}
        </Flex>
      </FullViewport>
    </SentryDocumentTitle>
  );
}
