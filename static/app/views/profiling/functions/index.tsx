import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, Project, RequestState} from 'sentry/types';
import {VersionedFunctionCalls} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import {FunctionsContent} from './content';

interface Props {
  location: Location;
  params: {
    projectId?: Project['slug'];
  };
  selection?: PageFilters;
}

function FunctionsPage(props: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {projects} = useProjects();

  const version = decodeScalar(props.location.query.version);
  const transaction = decodeScalar(props.location.query.transaction);

  const [requestState, setRequestState] = useState<RequestState<VersionedFunctionCalls>>({
    type: 'initial',
  });

  const project = useMemo(
    () => projects.find(p => p.slug === props.params.projectId),
    [projects, props.params.projectId]
  );

  const badParams =
    !defined(props.params.projectId) || !defined(transaction) || !defined(version);

  useEffect(() => {
    if (badParams) {
      return undefined;
    }

    setRequestState({type: 'loading'});

    fetchFunctions(api, organization, {
      projectSlug: props.params.projectId!,
      transaction,
      version,
    })
      .then(functions => {
        setRequestState({type: 'resolved', data: functions});
      })
      .catch(err => {
        setRequestState({type: 'errored', error: t('Error: Unable to load functions')});
        Sentry.captureException(err);
      });

    return () => api.clear();
  }, [
    api,
    organization,
    setRequestState,
    props.params.projectId,
    transaction,
    version,
    badParams,
  ]);

  return (
    <SentryDocumentTitle
      title={t('Profiling \u2014 Functions')}
      orgSlug={organization.slug}
    >
      <PageFiltersContainer
        lockedMessageSubject={t('transaction')}
        shouldForceProject={defined(project)}
        forceProject={project}
        specificProjectSlugs={defined(project) ? [project.slug] : []}
        disableMultipleProjectSelection
        showProjectSettingsLink
        hideGlobalHeader
      >
        <NoProjectMessage organization={organization}>
          {badParams && (
            <Alert type="error" showIcon>
              {t('Missing required parameters.')}
            </Alert>
          )}
          {project && !badParams && (
            <Fragment>
              <Layout.Header>
                <Layout.HeaderContent>
                  <Breadcrumb
                    location={props.location}
                    organization={organization}
                    trails={[
                      {type: 'landing'},
                      {
                        type: 'functions',
                        payload: {
                          projectSlug: project.slug,
                          transaction,
                          version,
                        },
                      },
                    ]}
                  />
                  <Layout.Title>
                    <Title>
                      <IdBadge
                        project={project}
                        avatarSize={28}
                        hideName
                        avatarProps={{hasTooltip: true, tooltip: project.slug}}
                      />
                      {tct('[transaction] \u2014 [version]', {
                        transaction,
                        version,
                      })}
                    </Title>
                  </Layout.Title>
                </Layout.HeaderContent>
              </Layout.Header>
              <Layout.Body>
                <FunctionsContent
                  project={project}
                  isLoading={requestState.type === 'loading'}
                  error={requestState.type === 'errored' ? requestState.error : null}
                  version={version}
                  versionedFunctions={
                    requestState.type === 'resolved' ? requestState.data : null
                  }
                />
              </Layout.Body>
            </Fragment>
          )}
        </NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function fetchFunctions(
  api: Client,
  organization: Organization,
  {
    projectSlug,
    transaction,
    version,
  }: {
    projectSlug: Project['slug'];
    transaction: string;
    version: string;
  }
) {
  return api.requestPromise(
    `/projects/${organization.slug}/${projectSlug}/profiling/functions/`,
    {
      method: 'GET',
      includeAllArgs: false,
      query: {
        query: `transaction_name:"${transaction}" version:"${version}"`,
      },
    }
  );
}

const Title = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

export default withPageFilters(FunctionsPage);
