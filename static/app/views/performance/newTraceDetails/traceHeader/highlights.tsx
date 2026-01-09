import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {getContextIcon} from 'sentry/components/events/contexts/utils';
import {HighlightsIconSummary as TransactionEventHighlights} from 'sentry/components/events/highlights/highlightsIconSummary';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconGlobe} from 'sentry/icons';
import {IconReleases} from 'sentry/icons/iconReleases';
import {IconWindow} from 'sentry/icons/iconWindow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {findSpanAttributeValue} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

type HighlightDefinition = {
  getSummary: () => {description: React.ReactNode; icon: React.ReactNode} | null;
  key: string;
};

function getParsedAttributeValue(value: string | undefined) {
  const parts = value?.split(' ') ?? [];
  const version = parts.pop();
  const name = parts.join(' ');
  return {name, version};
}

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
        const runtime = findSpanAttributeValue(attributes, 'runtime');

        if (!runtime) {
          return null;
        }

        const {name, version} = getParsedAttributeValue(runtime);

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
        const email = findSpanAttributeValue(attributes, 'user.email');
        const ip_address = findSpanAttributeValue(attributes, 'user.ip');
        const id = findSpanAttributeValue(attributes, 'user.id');

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
        const browser = findSpanAttributeValue(attributes, 'browser');

        if (!browser) {
          return null;
        }

        const {name, version} = getParsedAttributeValue(browser);

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
        const os = findSpanAttributeValue(attributes, 'os');

        if (!os) {
          return null;
        }

        const {name, version} = getParsedAttributeValue(os);

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

        const version =
          findSpanAttributeValue(attributes, 'sentry.release') ??
          findSpanAttributeValue(attributes, 'release');

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
        const region = findSpanAttributeValue(attributes, 'region');

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
        const environment = findSpanAttributeValue(attributes, 'environment');
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
    <ScrollCarousel gap={2} aria-label={t('Attributes Highlights')}>
      {highlights.map(highlight => {
        const summary = highlight.getSummary();

        if (!summary) {
          return null;
        }

        return (
          <HighlightsContainer key={highlight.key}>
            <HighlightsIconWrapper>{summary.icon}</HighlightsIconWrapper>
            <HighlightsDescription>{summary.description}</HighlightsDescription>
          </HighlightsContainer>
        );
      })}
    </ScrollCarousel>
  );
}

const HighlightsContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const HighlightsDescription = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  font-size: ${p => p.theme.fontSize.md};
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
  font-size: ${p => p.theme.fontSize.md};
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

function Highlights({rootEventResults, organization, project}: HighlightsProps) {
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

export default Highlights;
