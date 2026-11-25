import {Fragment, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {IconEdit} from '@sentry/icons/edit';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {DescriptionList} from '@sentry/scraps/descriptionList';
import {EmptyState} from '@sentry/scraps/emptyState';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Markdown} from '@sentry/scraps/markdown';
import {Heading, Text} from '@sentry/scraps/text';

import {Feature} from 'sentry/components/acl/feature';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {TraceItemAttributeType} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {ProjectAttributeMetadataForm} from './projectAttributeMetadataForm';
import {
  ATTRIBUTES_STATS_PERIOD,
  ATTRIBUTES_STATS_PERIOD_LABEL,
  DATASET_LABELS,
  isAttributeType,
  type Attribute,
  type AttributeDetails as AttributeDetailsResponse,
  UNIT_LABELS,
} from './projectAttributesCommon';
import {useProjectSettingsOutlet} from './projectSettingsLayout';

function ProjectAttributeDetailsSettings() {
  const {project} = useProjectSettingsOutlet();
  const {attributeName, attributeType} = useParams<{
    attributeName: string;
    attributeType: string;
  }>();

  return (
    <SentryDocumentTitle title={attributeName} projectSlug={project.slug}>
      <SettingsPageHeader
        title={{
          type: 'page-title',
          label: attributeName,
          trailingActions: {type: 'badge', element: <FeatureBadge type="beta" />},
        }}
      />
      {isAttributeType(attributeType) ? (
        <AttributeDetails attributeName={attributeName} attributeType={attributeType} />
      ) : (
        <AttributeNotFound />
      )}
    </SentryDocumentTitle>
  );
}

function AttributeDetails({
  attributeName,
  attributeType,
}: {
  attributeName: string;
  attributeType: TraceItemAttributeType;
}) {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const [attributeSource] = useQueryState(
    'source',
    parseAsStringLiteral(['sentry', 'user'] as const)
  );

  const queryClient = useQueryClient();
  const detailsOptions = apiOptions.as<AttributeDetailsResponse>()(
    '/organizations/$organizationIdOrSlug/trace-items/attributes/details/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        attributeName,
        attributeSource: attributeSource ?? undefined,
        attributeType,
        project: [project.id],
        statsPeriod: ATTRIBUTES_STATS_PERIOD,
      },
      staleTime: 0,
    }
  );
  const {data: attribute, error, isPending, isError, refetch} = useQuery(detailsOptions);

  function handleSave(context: Attribute['context']) {
    queryClient.setQueryData(
      detailsOptions.queryKey,
      previous => previous && {...previous, json: {...previous.json, context}}
    );
    queryClient.invalidateQueries(
      apiOptions.queryFilter(
        '/organizations/$organizationIdOrSlug/trace-items/attributes/merged/',
        {path: {organizationIdOrSlug: organization.slug}}
      )
    );
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return error instanceof RequestError && error.status === 404 ? (
      <AttributeNotFound />
    ) : (
      <LoadingError onRetry={refetch} />
    );
  }

  return (
    <Stack gap="xl">
      <Flex justify="between" align="start" gap="xl" wrap="wrap">
        <Stack gap="sm" align="start">
          <Heading as="h2">{attribute.name}</Heading>
          <Tag variant="muted">{attribute.attributeType}</Tag>
        </Stack>
        <AttributeStats attribute={attribute} />
      </Flex>
      <Grid
        columns={{zero: 'minmax(0, 1fr)', '2xl': 'minmax(0, 1fr) minmax(0, 20rem)'}}
        gap="xl"
        align="start"
      >
        <AttributeMetadata attribute={attribute} onSave={handleSave} />
        <AttributeSidebar attribute={attribute} />
      </Grid>
    </Stack>
  );
}

function AttributeStats({attribute}: {attribute: AttributeDetailsResponse}) {
  const {attributeType, datasets, lastSeen, stats} = attribute;
  const hasCardinality = attributeType === 'string' || attributeType === 'number';

  return (
    <Stack gap="xs" align="end">
      <Flex gap="2xl">
        <Stack gap="2xs">
          <Text size="sm" variant="muted">
            {t('Last seen')}
          </Text>
          <Text size="lg">{lastSeen ? <TimeSince date={lastSeen} /> : '—'}</Text>
        </Stack>
        {hasCardinality && (
          <Stack gap="2xs">
            <Text size="sm" variant="muted">
              {t('Cardinality')}
            </Text>
            {datasets.length === 1 ? (
              <Text size="lg">{formatCardinality(stats[datasets[0]!]?.cardinality)}</Text>
            ) : (
              <Flex gap="md" wrap="wrap">
                {datasets.map(dataset => (
                  <Flex key={dataset} gap="xs" align="baseline">
                    <Text size="lg">
                      {formatCardinality(stats[dataset]?.cardinality)}
                    </Text>
                    <Text size="sm" variant="muted">
                      {DATASET_LABELS[dataset]}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            )}
          </Stack>
        )}
      </Flex>
      <Text size="xs" variant="muted">
        {ATTRIBUTES_STATS_PERIOD_LABEL}
      </Text>
    </Stack>
  );
}

function formatCardinality(cardinality: number | null | undefined) {
  return typeof cardinality === 'number'
    ? `≈${formatAbbreviatedNumber(cardinality)}`
    : '—';
}

function AttributeNotFound() {
  return (
    <EmptyState
      title={t('Attribute not found')}
      description={t('This attribute was not sent to this project in the last 14 days.')}
    />
  );
}

function getEditDisabledReason(
  attribute: AttributeDetailsResponse,
  hasWriteAccess: boolean
): string | undefined {
  if (attribute.isEditable) {
    return hasWriteAccess
      ? undefined
      : t("You don't have permission to edit attribute metadata.");
  }
  if (
    attribute.attributeSource.source_type === 'sentry' ||
    attribute.context?.isConvention
  ) {
    return t("Sentry-defined attributes can't be edited.");
  }
  if (attribute.attributeType === 'array') {
    return t("Array attributes can't be edited.");
  }
  return t("Attributes named like a Sentry-defined attribute can't be edited.");
}

function AttributeMetadata({
  attribute,
  onSave,
}: {
  attribute: AttributeDetailsResponse;
  onSave: (context: Attribute['context']) => void;
}) {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const [isEditing, setIsEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const {context} = attribute;
  function stopEditing() {
    flushSync(() => setIsEditing(false));
    editButtonRef.current?.focus();
  }

  const editDisabledReason = getEditDisabledReason(
    attribute,
    organization.access.includes('event:write')
  );

  return (
    <Container border="primary" radius="md" padding="lg">
      <Stack gap="lg">
        <Flex justify="between" align="center" gap="md">
          <Stack gap="xs">
            <Heading as="h3">{t('Metadata')}</Heading>
            {isEditing ? (
              <Text size="sm" variant="muted">
                {t('Changes apply to this project only.')}
              </Text>
            ) : (
              context?.isCustom && (
                <Text size="sm" variant="muted">
                  {context.isProjectScoped
                    ? t('Applies to this project only.')
                    : t('Applies to every project in this organization.')}
                </Text>
              )
            )}
          </Stack>
          {organization.features.includes('data-browsing-attribute-context') &&
            !isEditing && (
              <Button
                ref={editButtonRef}
                size="xs"
                icon={<IconEdit />}
                disabled={editDisabledReason !== undefined}
                tooltipProps={{title: editDisabledReason}}
                onClick={() => setIsEditing(true)}
              >
                {t('Edit')}
              </Button>
            )}
        </Flex>
        {isEditing ? (
          <ProjectAttributeMetadataForm
            attribute={attribute}
            project={project}
            onCancel={stopEditing}
            onSave={savedContext => {
              onSave(savedContext);
              stopEditing();
            }}
          />
        ) : (
          <AttributeMetadataDetails context={context} />
        )}
      </Stack>
    </Container>
  );
}

function AttributeMetadataDetails({context}: {context: Attribute['context']}) {
  return (
    <DescriptionList gap="md lg">
      <DescriptionList.Term>{t('Description')}</DescriptionList.Term>
      <DescriptionList.Details>
        {context?.brief ? (
          <Markdown raw={context.brief} />
        ) : (
          <Text variant="muted">—</Text>
        )}
      </DescriptionList.Details>
      {context?.isDeprecated && (
        <Fragment>
          <DescriptionList.Term>{t('Status')}</DescriptionList.Term>
          <DescriptionList.Details>
            <Flex align="center" gap="sm" wrap="wrap">
              <Tag variant="warning">{t('Deprecated')}</Tag>
              {context.replacementAttribute && (
                <Text>
                  {tct('Use [replacement] instead.', {
                    replacement: <Text monospace>{context.replacementAttribute}</Text>,
                  })}
                </Text>
              )}
            </Flex>
          </DescriptionList.Details>
        </Fragment>
      )}
      {context?.details?.length ? (
        <Fragment>
          <DescriptionList.Term>{t('Notes')}</DescriptionList.Term>
          <DescriptionList.Details>
            <Stack gap="lg">
              {context.details.map(detail => (
                <Markdown key={detail} raw={detail} />
              ))}
            </Stack>
          </DescriptionList.Details>
        </Fragment>
      ) : null}
      {context?.examples?.length ? (
        <Fragment>
          <DescriptionList.Term>{t('Examples')}</DescriptionList.Term>
          <DescriptionList.Details>
            <Flex gap="xs" wrap="wrap">
              {context.examples.map(example => (
                <InlineCode key={String(example)} variant="neutral">
                  {String(example)}
                </InlineCode>
              ))}
            </Flex>
          </DescriptionList.Details>
        </Fragment>
      ) : null}
    </DescriptionList>
  );
}

function AttributeSidebar({attribute}: {attribute: AttributeDetailsResponse}) {
  const {changelog, context, datasets, stats} = attribute;
  const modifiedCount = stats.spans?.modifiedCount;

  return (
    <Stack gap="xl">
      <Container border="primary" radius="md" padding="lg">
        <DescriptionList gap="md lg">
          <DescriptionList.Term>{t('Source')}</DescriptionList.Term>
          <DescriptionList.Details>
            <AttributeSourceTags attribute={attribute} />
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Datasets')}</DescriptionList.Term>
          <DescriptionList.Details>
            <Flex gap="xs" wrap="wrap">
              {datasets.map(dataset => (
                <Tag key={dataset} variant="muted">
                  {DATASET_LABELS[dataset]}
                </Tag>
              ))}
            </Flex>
          </DescriptionList.Details>
          {context?.unit && (
            <Fragment>
              <DescriptionList.Term>{t('Unit')}</DescriptionList.Term>
              <DescriptionList.Details>
                {UNIT_LABELS[context.unit] ?? context.unit}
              </DescriptionList.Details>
            </Fragment>
          )}
          {typeof modifiedCount === 'number' && (
            <Fragment>
              <DescriptionList.Term>
                <Flex gap="xs" align="center">
                  {t('Modified by Relay')}
                  <InfoTip
                    size="xs"
                    title={t(
                      "Stored spans in the last 14 days where Relay modified this attribute's value, such as by truncating or scrubbing it."
                    )}
                  />
                </Flex>
              </DescriptionList.Term>
              <DescriptionList.Details>
                {modifiedCount.toLocaleString()}
              </DescriptionList.Details>
            </Fragment>
          )}
        </DescriptionList>
      </Container>
      {changelog?.length ? (
        <Container border="primary" radius="md" padding="lg">
          <Stack gap="lg">
            <Heading as="h3">{t('Changelog')}</Heading>
            <Stack gap="md">
              {changelog.map(entry => (
                <Stack key={entry.version} gap="2xs">
                  <Flex gap="sm" align="baseline" wrap="wrap">
                    <Text bold monospace>
                      {entry.version}
                    </Text>
                    {entry.prs?.map(pr => (
                      <ExternalLink
                        key={pr}
                        href={`https://github.com/getsentry/sentry-conventions/pull/${pr}`}
                      >
                        #{pr}
                      </ExternalLink>
                    ))}
                  </Flex>
                  {entry.description && <Markdown raw={entry.description} />}
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Container>
      ) : null}
    </Stack>
  );
}

function AttributeSourceTags({attribute}: {attribute: Attribute}) {
  const {attributeSource, context} = attribute;

  if (context?.isConvention) {
    return (
      <Flex gap="xs" wrap="wrap">
        <Tag variant="info">{t('Sentry convention')}</Tag>
        {context.isInOtel && <Tag variant="info">{t('OpenTelemetry')}</Tag>}
      </Flex>
    );
  }

  if (attributeSource.source_type === 'sentry') {
    return <Tag variant="muted">{t('Sentry')}</Tag>;
  }

  return <Tag variant="muted">{t('Custom')}</Tag>;
}

export default function ProjectAttributeDetails() {
  return (
    <Feature features="attribute-management">
      <ProjectAttributeDetailsSettings />
    </Feature>
  );
}
