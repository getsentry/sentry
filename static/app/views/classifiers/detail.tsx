import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ClassifierInstancesChart} from './components/classifierInstancesChart';
import {
  ClassifierDisabledAlert,
  ClassifierStatusToggle,
} from './components/classifierStatus';
import {useClassifier} from './hooks/useClassifier';
import type {TelemetryClassifier} from './types';
import {getClassifiersPath, getDatasetLabel} from './utils';

function HeaderStat({label}: {label: string}) {
  return (
    <Stack gap="xs">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <Text size="2xl" variant="muted">
        {'\u2014'}
      </Text>
    </Stack>
  );
}

function ComingSoon({height}: {height: `${number}px`}) {
  return (
    <Flex
      align="center"
      justify="center"
      height={height}
      border="primary"
      radius="md"
      background="secondary"
    >
      <Text variant="muted">{t('Coming soon')}</Text>
    </Flex>
  );
}

function ClassifierDetailContent({classifier}: {classifier: TelemetryClassifier}) {
  return (
    <Stack gap="xl" padding="xl">
      <Flex justify="between" align="center" gap="xl" wrap="wrap">
        <Heading as="h2" size="2xl">
          {classifier.name}
        </Heading>
        <Flex align="center" gap="2xl">
          <HeaderStat label={t('Conversations')} />
          <ClassifierStatusToggle classifier={classifier} />
        </Flex>
      </Flex>
      <ClassifierDisabledAlert classifier={classifier} />
      <Grid columns={{zero: '1fr', lg: 'minmax(0, 1fr) 350px'}} gap="xl" align="start">
        <Stack gap="xl" minWidth="0">
          <ClassifierInstancesChart classifier={classifier} />
          <Stack gap="md">
            <Heading as="h3" size="md">
              {t('Matched conversations')}
            </Heading>
            <ComingSoon height="480px" />
          </Stack>
        </Stack>
        <Container border="primary" radius="md" padding="lg">
          <Flex align="center" gap="sm">
            <Text bold>{t('Dataset:')}</Text>
            <Tag variant="muted">{getDatasetLabel(classifier.dataset)}</Tag>
          </Flex>
        </Container>
      </Grid>
    </Stack>
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
        <ClassifierDetailContent classifier={classifier} />
      )}
    </SentryDocumentTitle>
  );
}
