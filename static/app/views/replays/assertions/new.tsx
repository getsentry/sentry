import {useEffect, useState} from 'react';
import {uuid4} from '@sentry/core';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Tooltip} from 'sentry/components/core/tooltip';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import AssertionBaseForm from 'sentry/components/replays/assertions/assertionBaseForm';
import AssertionCreateEditForm from 'sentry/components/replays/assertions/assertionCreateEditForm';
import useAssertionPageCrumbs from 'sentry/components/replays/assertions/assertionPageCrumbs';
import useAssertionBaseFormQueryParams from 'sentry/components/replays/assertions/useAssertionBaseFormQueryParams';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useMutation} from 'sentry/utils/queryClient';
import AssertionDatabase from 'sentry/utils/replays/assertions/database';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function ReplayAssertionNew() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const {project, environment, name} = useAssertionBaseFormQueryParams();
  const crumbs = useAssertionPageCrumbs({label: t('Create New')});

  const [assertion, setAssertion] = useState<AssertionFlow>(() => {
    const id = uuid4();
    return {
      alerts_enabled: false,
      assigned_to: undefined,
      created_at: new Date().toISOString(), // ISO 8601
      description: '',
      ending_actions: [],
      environment,
      id,
      name,
      original_id: id,
      prev_id: undefined,
      project_id: project?.id ?? '',
      starting_action: {matcher: null, type: 'null'},
      status: 'success',
      timeout: 5 * 60 * 1000, // 5 minutes
    };
  });

  useEffect(() => {
    setAssertion(prev => {
      if (
        project?.id !== prev.project_id ||
        environment !== prev.environment ||
        name !== prev.name
      ) {
        return {
          ...prev,
          project_id: project?.id ?? '',
          environment,
          name,
        };
      }
      return prev;
    });
  }, [project, environment, name]);

  const {mutate: createAssertion} = useMutation({
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
      navigate(
        makeReplaysPathname({
          path: `/assertions/details/${assertion.id}/`,
          organization,
        })
      );
    },
  });

  const hasProjectAndEnvironment = Boolean(assertion.project_id && assertion.environment);

  return (
    <SentryDocumentTitle
      title={t('Replay Flows - Create New')}
      orgSlug={organization.slug}
    >
      <FullViewport style={{height: '100vh'}}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} style={{padding: 0}} />
            <Flex gap="lg" align="center">
              <Layout.Title style={{width: 'auto'}}>
                {t('Create Assertion')}
                <PageHeadingQuestionTooltip
                  title={t('Assert that users are doing what you expect them to do.')}
                  docsUrl="https://docs.sentry.io/product/session-replay/"
                />
              </Layout.Title>
              <AssertionBaseForm />
            </Flex>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <Flex gap="md">
              <Tooltip
                disabled={hasProjectAndEnvironment}
                title={t('Pick a Project and Environment above to start')}
              >
                <Button
                  disabled={!hasProjectAndEnvironment}
                  priority="primary"
                  onClick={() => {
                    if (hasProjectAndEnvironment) {
                      createAssertion(assertion);
                    }
                  }}
                >
                  {t('Save')}
                </Button>
              </Tooltip>
            </Flex>
          </Layout.HeaderActions>
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
          {hasProjectAndEnvironment ? (
            <AssertionCreateEditForm
              assertion={assertion}
              setAssertion={value => {
                setAssertion(value);
              }}
            />
          ) : (
            <p>{t('Pick a Project and Environment above to start')}</p>
          )}
        </Flex>
      </FullViewport>
    </SentryDocumentTitle>
  );
}
