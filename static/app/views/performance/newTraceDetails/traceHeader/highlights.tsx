import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getContextIcon} from 'sentry/components/events/contexts/utils';
import {HighlightsIconSummary as TransactionEventHighlights} from 'sentry/components/events/highlights/highlightsIconSummary';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {IconGlobe} from 'sentry/icons';
import {IconReleases} from 'sentry/icons/iconReleases';
import {IconWindow} from 'sentry/icons/iconWindow';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getAttributeValue} from 'sentry/utils/fields/getAttributeValue';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';

type HighlightDefinition = {
  getSummary: () => {description: React.ReactNode; icon: React.ReactNode} | null;
  key: string;
};

function AttributesHighlights({
  traceItemDetail,
  organization,
  project,
}: {
  organization: Organization;
  project: Project | undefined;
  traceItemDetail: TraceItemDetailsResponse;
}) {
  const {attributes} = traceItemDetail;
  const theme = useTheme();

  const highlights: HighlightDefinition[] = [
    {
      key: 'runtime',
      getSummary: () => {
        // Resolve the name and version as a pair so a span that has only part of
        // each family can't report a version belonging to a different runtime.
        const isOtelRuntime = attributes.some(
          ({name}) => prettifyAttributeName(name) === 'process.runtime.name'
        );
        const nameKey = isOtelRuntime ? 'process.runtime.name' : 'runtime.name';
        const versionKey = isOtelRuntime ? 'process.runtime.version' : 'runtime.version';
        const name = getAttributeValue(attributes, nameKey, 'string');
        const version = getAttributeValue(
          attributes.filter(
            attribute => prettifyAttributeName(attribute.name) === versionKey
          ),
          versionKey,
          'string'
        );

        if (!name) {
          return null;
        }

        return {
          icon: getContextIcon({
            alias: 'runtime',
            type: 'runtime',
            value: {
              name,
              version,
            },
            contextIconProps: {
              size: 'md',
            },
            theme,
          }),
          description: (
            <Fragment>
              {name}
              {version && (
                <HighlightsSubtitle title={t('Runtime Version')}>
                  {version}
                </HighlightsSubtitle>
              )}
            </Fragment>
          ),
        };
      },
    },
    {
      key: 'user',
      getSummary: () => {
        const email = getAttributeValue(attributes, 'user.email', 'string');
        const ip_address = getAttributeValue(attributes, 'user.ip', 'string');
        const id = getAttributeValue(attributes, 'user.id', 'string');

        if (!email && !ip_address) {
          return null;
        }

        return {
          icon: getContextIcon({
            alias: 'user',
            type: 'user',
            value: {
              email,
              ip_address,
              id,
            },
            contextIconProps: {
              size: 'md',
            },
            theme,
          }),
          description: (
            <Fragment>
              {email ?? ip_address}
              {id && <HighlightsSubtitle title={t('User ID')}>{id}</HighlightsSubtitle>}
            </Fragment>
          ),
        };
      },
    },
    {
      key: 'browser',
      getSummary: () => {
        const name = getAttributeValue(attributes, 'browser.name', 'string');
        const version = getAttributeValue(attributes, 'browser.version', 'string');

        if (!name) {
          return null;
        }

        return {
          icon: getContextIcon({
            alias: 'browser',
            type: 'browser',
            value: {
              name,
              version,
            },
            contextIconProps: {
              size: 'md',
            },
            theme,
          }),
          description: (
            <Fragment>
              {name}
              {version && (
                <HighlightsSubtitle title={t('Browser Version')}>
                  {version}
                </HighlightsSubtitle>
              )}
            </Fragment>
          ),
        };
      },
    },
    {
      key: 'os',
      getSummary: () => {
        const name = getAttributeValue(attributes, 'os.name', 'string');
        const version = getAttributeValue(attributes, 'os.version', 'string');

        if (!name) {
          return null;
        }

        return {
          icon: getContextIcon({
            alias: 'os',
            type: 'os',
            value: {
              name,
              version,
            },
            contextIconProps: {
              size: 'md',
            },
            theme,
          }),
          description: (
            <Fragment>
              {name}
              {version && (
                <HighlightsSubtitle title={t('OS Version')}>{version}</HighlightsSubtitle>
              )}
            </Fragment>
          ),
        };
      },
    },
    {
      key: 'release',
      getSummary: () => {
        if (!project) {
          return null;
        }

        const version = getAttributeValue(attributes, 'release', 'string');

        if (!version) {
          return null;
        }

        return {
          icon: <IconReleases size="sm" variant="muted" />,
          description: (
            <VersionHoverCard
              organization={organization}
              projectSlug={project.slug}
              releaseVersion={version}
            >
              <StyledVersion version={version} projectId={project.id} />
            </VersionHoverCard>
          ),
        };
      },
    },
    {
      key: 'uptime-check-region',
      getSummary: () => {
        const region = getAttributeValue(attributes, 'region', 'string');

        if (!region) {
          return null;
        }

        return {
          icon: <IconGlobe size="sm" variant="muted" />,
          description: t('Check from %s', region),
        };
      },
    },
    {
      key: 'environment',
      getSummary: () => {
        const environment = getAttributeValue(attributes, 'environment', 'string');
        if (!environment) {
          return null;
        }
        return {
          icon: <IconWindow size="sm" variant="muted" />,
          description: <Tooltip title={t('Environment')}>{environment}</Tooltip>,
        };
      },
    },
  ];

  return (
    <ScrollCarousel gap="xl" aria-label={t('Attributes Highlights')}>
      {highlights.map(highlight => {
        const summary = highlight.getSummary();

        if (!summary) {
          return null;
        }

        return (
          <Flex align="center" gap="md" flex="0 0 auto" key={highlight.key}>
            <HighlightsIconWrapper>{summary.icon}</HighlightsIconWrapper>
            <HighlightsDescription>{summary.description}</HighlightsDescription>
          </Flex>
        );
      })}
    </ScrollCarousel>
  );
}

const HighlightsDescription = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  font-size: ${p => p.theme.font.size.md};
`;

const HighlightsIconWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex: none;
  line-height: 1;
`;

const HighlightsSubtitle = styled(Tooltip)`
  display: block;
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledVersion = styled(Version)`
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.primary};
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

type HighlightsProps = {
  organization: Organization;
  project: Project | undefined;
  rootEventResults: TraceRootEventQueryResults;
};

export function Highlights({rootEventResults, organization, project}: HighlightsProps) {
  if (!rootEventResults.data) {
    return null;
  }

  if (isTraceItemDetailsResponse(rootEventResults.data)) {
    return (
      <AttributesHighlights
        traceItemDetail={rootEventResults.data}
        organization={organization}
        project={project}
      />
    );
  }

  return (
    <TransactionEventHighlightsWrapper>
      <TransactionEventHighlights event={rootEventResults.data} />
    </TransactionEventHighlightsWrapper>
  );
}

const TransactionEventHighlightsWrapper = styled('span')`
  display: flex;
  align-items: center;
  & > div {
    padding: 0;
  }
`;
