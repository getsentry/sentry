import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {InlineCode} from '@sentry/scraps/code';
import {DescriptionList} from '@sentry/scraps/descriptionList';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Heading, Text} from '@sentry/scraps/text';

import {Feature} from 'sentry/components/acl/feature';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {TraceItemAttributeType} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {
  ATTRIBUTES_STATS_PERIOD,
  isAttributeType,
  type Attribute,
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

  const {
    data: attribute,
    error,
    isPending,
    isError,
    refetch,
  } = useQuery(
    apiOptions.as<Attribute>()(
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
    )
  );

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
      <Stack gap="sm" align="start">
        <Heading as="h2">{attribute.name}</Heading>
        <Tag variant="muted">{attribute.attributeType}</Tag>
      </Stack>
      <AttributeMetadata attribute={attribute} />
    </Stack>
  );
}

function AttributeNotFound() {
  return (
    <EmptyState
      title={t('Attribute not found')}
      description={t('This attribute was not sent to this project in the last 14 days.')}
    />
  );
}

function AttributeMetadata({attribute}: {attribute: Attribute}) {
  const {context} = attribute;

  return (
    <Container border="primary" radius="md" padding="lg">
      <Stack gap="lg">
        <Heading as="h3">{t('Metadata')}</Heading>
        <DescriptionList gap="md lg">
          <DescriptionList.Term>{t('Description')}</DescriptionList.Term>
          <DescriptionList.Details>
            {context?.brief ? (
              <Markdown raw={context.brief} />
            ) : (
              <Text variant="muted">—</Text>
            )}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Source')}</DescriptionList.Term>
          <DescriptionList.Details>{getSourceLabel(attribute)}</DescriptionList.Details>
          {context?.isDeprecated && (
            <Fragment>
              <DescriptionList.Term>{t('Status')}</DescriptionList.Term>
              <DescriptionList.Details>
                <Flex align="center" gap="sm" wrap="wrap">
                  <Tag variant="warning">{t('Deprecated')}</Tag>
                  {context.replacementAttribute && (
                    <Text>
                      {tct('Use [replacement] instead.', {
                        replacement: (
                          <Text monospace>{context.replacementAttribute}</Text>
                        ),
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
      </Stack>
    </Container>
  );
}

function getSourceLabel(attribute: Attribute) {
  if (attribute.attributeSource.source_type === 'sentry') {
    return t('Added by Sentry');
  }

  return attribute.context?.isConvention ? t('Sentry convention') : t('Custom');
}

export default function ProjectAttributeDetails() {
  return (
    <Feature features="attribute-management">
      <ProjectAttributeDetailsSettings />
    </Feature>
  );
}
