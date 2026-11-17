import {Fragment} from 'react';

import {UserAvatar} from '@sentry/scraps/avatar';
import {DescriptionList} from '@sentry/scraps/descriptionList';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import {userDisplayName} from 'sentry/utils/formatters';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ClassifiedConversationsTable} from './components/classifiedConversationsTable';
import {ClassifierFilters} from './components/classifierFilters';
import {ClassifierInstancesChart} from './components/classifierInstancesChart';
import {
  ClassifierDisabledAlert,
  ClassifierStatusToggle,
} from './components/classifierStatus';
import {ResultAttributeName} from './components/resultAttributeName';
import {useClassifier} from './hooks/useClassifier';
import {usePrebuiltClassifiers} from './hooks/usePrebuiltClassifiers';
import type {TelemetryClassifier} from './types';
import {
  CLASSIFIER_DETAIL_DEFAULT_SELECTION,
  getClassifiersPath,
  filterQueryHasEnvironment,
  getClassifierFilterParts,
  getDatasetLabel,
  getOutputTypeLabel,
} from './utils';

function OverflowValue({value}: {value: string}) {
  return (
    <InfoText title={value} mode="overflowOnly" variant="inherit">
      {value}
    </InfoText>
  );
}

function useClassifierTypeLabel(classifier: TelemetryClassifier) {
  const prebuiltKey = classifier.prebuiltClassifierKey;
  const {data: prebuiltClassifiers, isPending} = usePrebuiltClassifiers(
    classifier.dataset,
    {enabled: prebuiltKey !== null}
  );

  if (prebuiltKey === null) {
    return {isPending: false, label: t('Custom')};
  }
  const prebuilt = prebuiltClassifiers?.find(({key}) => key === prebuiltKey);
  return {isPending, label: prebuilt?.name ?? prebuiltKey};
}

function ClassifierDetails({
  classifier,
  typeLabel,
}: {
  classifier: TelemetryClassifier;
  typeLabel: string;
}) {
  const project = useProjectFromId({project_id: classifier.projectId});
  const {environments, agents} = getClassifierFilterParts(classifier.filterQuery);

  return (
    <Stack as="section" gap="md">
      <Heading as="h3" size="md">
        {t('Details')}
      </Heading>
      <DescriptionList striped columns="min-content auto">
        <DescriptionList.Term>{t('Type')}</DescriptionList.Term>
        <DescriptionList.Details>
          <OverflowValue value={typeLabel} />
        </DescriptionList.Details>
        <DescriptionList.Term>{t('Dataset')}</DescriptionList.Term>
        <DescriptionList.Details>
          {getDatasetLabel(classifier.dataset)}
        </DescriptionList.Details>
        {project && (
          <Fragment>
            <DescriptionList.Term>{t('Project')}</DescriptionList.Term>
            <DescriptionList.Details>
              <Flex justify="end" align="center" minHeight="1lh">
                <ProjectBadge project={project} disableLink avatarSize={16} />
              </Flex>
            </DescriptionList.Details>
          </Fragment>
        )}
        {environments.length > 0 && (
          <Fragment>
            <DescriptionList.Term>
              {tn('Environment', 'Environments', environments.length)}
            </DescriptionList.Term>
            <DescriptionList.Details>
              <OverflowValue value={environments.join(', ')} />
            </DescriptionList.Details>
          </Fragment>
        )}
        {agents.length > 0 && (
          <Fragment>
            <DescriptionList.Term>
              {tn('Agent', 'Agents', agents.length)}
            </DescriptionList.Term>
            <DescriptionList.Details>
              <OverflowValue value={agents.join(', ')} />
            </DescriptionList.Details>
          </Fragment>
        )}
        <DescriptionList.Term>{t('Result attribute')}</DescriptionList.Term>
        <DescriptionList.Details>
          <ResultAttributeName
            resultAttribute={classifier.resultAttribute}
            align="right"
          />
        </DescriptionList.Details>
        {classifier.outputType && (
          <Fragment>
            <DescriptionList.Term>{t('Output type')}</DescriptionList.Term>
            <DescriptionList.Details>
              {getOutputTypeLabel(classifier.outputType)}
            </DescriptionList.Details>
          </Fragment>
        )}
        {classifier.createdBy && (
          <Fragment>
            <DescriptionList.Term>{t('Created by')}</DescriptionList.Term>
            <DescriptionList.Details>
              <Flex align="center" justify="end" gap="sm">
                <UserAvatar user={classifier.createdBy} size={16} />
                {userDisplayName(classifier.createdBy, false)}
              </Flex>
            </DescriptionList.Details>
          </Fragment>
        )}
        <DescriptionList.Term>{t('Date created')}</DescriptionList.Term>
        <DescriptionList.Details>
          <DateTime date={classifier.dateAdded} dateOnly year />
        </DescriptionList.Details>
        <DescriptionList.Term>{t('Last modified')}</DescriptionList.Term>
        <DescriptionList.Details>
          <TimeSince date={classifier.dateUpdated} />
        </DescriptionList.Details>
      </DescriptionList>
    </Stack>
  );
}

function ClassifierSidebarSkeleton() {
  return (
    <Stack gap="md">
      <Placeholder width="80px" height="20px" />
      <Stack gap="sm">
        {Array.from({length: 8}, (_, index) => (
          <Placeholder key={index} height="20px" />
        ))}
      </Stack>
    </Stack>
  );
}

function ClassifierSidebar({classifier}: {classifier: TelemetryClassifier}) {
  const type = useClassifierTypeLabel(classifier);

  if (type.isPending) {
    return <ClassifierSidebarSkeleton />;
  }

  return (
    <Stack gap="2xl">
      <ClassifierDetails classifier={classifier} typeLabel={type.label} />
      <ClassifierFilters classifier={classifier} />
    </Stack>
  );
}

function ClassifierDetailContent({classifier}: {classifier: TelemetryClassifier}) {
  const showEnvironmentFilter = !filterQueryHasEnvironment(classifier.filterQuery);

  return (
    <Layout.Body gap="2xl">
      <Layout.Main>
        <Stack gap="xl">
          <Flex align="center" gap="sm" justify="between" wrap="wrap">
            <PageFilterBar condensed>
              {showEnvironmentFilter && (
                <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
              )}
              <DatePageFilter resetParamsOnChange={['cursor']} />
            </PageFilterBar>
            <Flex align="center" gap="sm" marginLeft="auto">
              <ClassifierStatusToggle classifier={classifier} />
            </Flex>
          </Flex>
          <ClassifierDisabledAlert classifier={classifier} />
          <ClassifierInstancesChart classifier={classifier} />
          <Stack gap="md">
            <Heading as="h3" size="md">
              {t('Classification results')}
            </Heading>
            <ClassifiedConversationsTable classifier={classifier} />
          </Stack>
        </Stack>
      </Layout.Main>
      <Layout.Side>
        <ClassifierSidebar classifier={classifier} />
      </Layout.Side>
    </Layout.Body>
  );
}

function ClassifierDetailPageFilters({
  classifier,
  children,
}: {
  children: React.ReactNode;
  classifier: TelemetryClassifier;
}) {
  const project = useProjectFromId({project_id: classifier.projectId});
  return (
    <PageFiltersContainer
      shouldForceProject
      forceProject={project}
      defaultSelection={CLASSIFIER_DETAIL_DEFAULT_SELECTION}
    >
      {children}
    </PageFiltersContainer>
  );
}

export default function ClassifierDetail() {
  const organization = useOrganization();
  const {classifierId} = useParams<{classifierId: string}>();

  const {
    data: classifier,
    isPending,
    isError,
    error,
    refetch,
  } = useClassifier(classifierId);

  return (
    <SentryDocumentTitle
      title={classifier?.name ?? t('Classifier')}
      orgSlug={organization.slug}
    >
      <TopBar.Slot
        name="breadcrumbs"
        title={{type: 'page-title', label: classifier?.name ?? t('Classifier')}}
        items={[
          {
            type: 'link',
            label: t('Classifiers'),
            to: getClassifiersPath(organization.slug),
          },
        ]}
      />
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          message={
            error instanceof RequestError && error.status === 404
              ? t('The classifier could not be found.')
              : undefined
          }
          onRetry={refetch}
        />
      ) : (
        <ClassifierDetailPageFilters classifier={classifier}>
          <ClassifierDetailContent classifier={classifier} />
        </ClassifierDetailPageFilters>
      )}
    </SentryDocumentTitle>
  );
}
