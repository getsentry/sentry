import AnalyticsArea from 'sentry/components/analyticsArea';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import NotFound from 'sentry/components/errors/notFound';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import AssertionEditForm from 'sentry/components/replays/flows/assertionEditForm';
import useAssertionPageCrumbs from 'sentry/components/replays/flows/assertionPageCrumbs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useMutation, useQuery, useQueryClient} from 'sentry/utils/queryClient';
import AssertionDatabase from 'sentry/utils/replays/assertions/database';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

export default function ReplayAssertionDetails() {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {assertionId} = useParams<{assertionId: string}>();

  const {
    data: assertion,
    isPending,
    error,
  } = useQuery<AssertionFlow | undefined, Error, AssertionFlow>({
    queryKey: ['flow', assertionId],
    queryFn: () => {
      AssertionDatabase.restore();
      const found = Array.from(AssertionDatabase.flows).find(
        flow => flow.id === assertionId
      );
      if (!found) {
        throw new Error(`Flow with id ${assertionId} not found`);
      }
      return found;
    },
    retry: false,
  });

  const {mutate: updateAssertion} = useMutation({
    mutationFn: (value: AssertionFlow) => {
      AssertionDatabase.restore();
      const old = Array.from(AssertionDatabase.flows).find(flow => flow.id === value.id);
      if (old) {
        AssertionDatabase.flows.delete(old);
        AssertionDatabase.flows.add(value);
      }
      AssertionDatabase.persist();
      return Promise.resolve(value);
    },
    onSuccess: () => {
      queryClient.refetchQueries({
        queryKey: ['flow', assertionId],
      });
    },
  });

  const crumbs = useAssertionPageCrumbs({label: assertionId});

  return (
    <AnalyticsArea name="details">
      <SentryDocumentTitle
        title={t('Replay Flows - %s', assertionId)}
        orgSlug={organization.slug}
      >
        <FullViewport>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs crumbs={crumbs} style={{padding: 0}} />
              <Flex gap="lg" align="center">
                <Layout.Title style={{width: 'auto'}}>
                  {assertion ? assertion.name : t('Loading...')}
                  <PageHeadingQuestionTooltip
                    title={t('Assert that users are doing what you expect them to do.')}
                    docsUrl="https://docs.sentry.io/product/session-replay/"
                  />
                </Layout.Title>
              </Flex>
            </Layout.HeaderContent>
            {assertion ? (
              <Layout.HeaderActions>
                <Flex gap="md">
                  <Button priority="primary">{t('Update')}</Button>
                </Flex>
              </Layout.HeaderActions>
            ) : null}
          </Layout.Header>
          <Flex
            background="primary"
            direction="column"
            flex="1"
            gap="lg"
            padding="lg 3xl"
            minHeight="0"
          >
            {isPending ? (
              <LoadingIndicator />
            ) : error ? (
              <NotFound />
            ) : assertion ? (
              <AssertionEditForm assertion={assertion} setAssertion={updateAssertion} />
            ) : (
              <NotFound />
            )}
          </Flex>
        </FullViewport>
      </SentryDocumentTitle>
    </AnalyticsArea>
  );
}
