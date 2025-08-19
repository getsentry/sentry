import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Tooltip} from 'sentry/components/core/tooltip';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import AssertionBaseForm from 'sentry/utils/replays/assertions/assertionBaseForm';
import AssertionCreateForm from 'sentry/utils/replays/assertions/assertionCreateForm';
import useAssertionPageCrumbs from 'sentry/utils/replays/assertions/assertionPageCrumbs';
import useAssertionBaseFormQueryParams from 'sentry/utils/replays/assertions/useAssertionBaseFormQueryParams';
import useOrganization from 'sentry/utils/useOrganization';

export default function ReplayAssertionNew() {
  const organization = useOrganization();
  const {project, environment, name} = useAssertionBaseFormQueryParams();
  const crumbs = useAssertionPageCrumbs({label: t('Create New')});

  const hasProjectAndEnvironment = Boolean(project && environment);

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
                <Button disabled={!hasProjectAndEnvironment} priority="primary">
                  Save
                </Button>
              </Tooltip>
            </Flex>
          </Layout.HeaderActions>
        </Layout.Header>
        <Body>
          {project && environment ? (
            <AssertionCreateForm
              environment={environment}
              name={name}
              projectId={project.id}
            />
          ) : (
            <p>{t('Pick a Project and Environment above to start')}</p>
          )}
        </Body>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const Body = styled('div')`
  background-color: ${p => p.theme.background};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
  min-height: 0;
  flex: 1;
  height: 100%;
`;
