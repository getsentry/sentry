import React, {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';

import {
  SourceMapDebugError,
  SourceMapDebugResponse,
  SourceMapProcessingIssueType,
  StacktraceFilenameQuery,
  useSourceMapDebugQueries,
} from './useSourceMapDebug';
import {sourceMapSdkDocsMap} from './utils';

const shortPathPlatforms = ['javascript', 'node', 'react-native'];
const sentryInit = <code>Sentry.init</code>;

function getErrorMessage(
  error: SourceMapDebugError,
  sdkName?: string
): Array<{
  title: string;
  /**
   * Expandable description
   */
  desc?: React.ReactNode;
  docsLink?: string;
}> {
  const docPlatform = (sdkName && sourceMapSdkDocsMap[sdkName]) ?? 'javascript';
  const useShortPath = shortPathPlatforms.includes(docPlatform);

  const baseSourceMapDocsLink = useShortPath
    ? `https://docs.sentry.io/platforms/${docPlatform}/sourcemaps/`
    : `https://docs.sentry.io/platforms/javascript/guides/${docPlatform}/sourcemaps/`;

  function getTroubleshootingLink(section?: string) {
    // react-native has a different troubleshooting page
    if (docPlatform === 'react-native') {
      return 'https://docs.sentry.io/platforms/react-native/troubleshooting/#source-maps';
    }
    return `${baseSourceMapDocsLink}troubleshooting_js/` + (section ? `#${section}` : '');
  }

  const defaultDocsLink = `${baseSourceMapDocsLink}#uploading-source-maps-to-sentry`;

  switch (error.type) {
    case SourceMapProcessingIssueType.MISSING_RELEASE:
      return [
        {
          title: t('Event missing Release tag'),
          desc: t(
            'Integrate Sentry into your release pipeline using a tool like Webpack or the CLI.'
          ),
          docsLink: defaultDocsLink,
        },
      ];
    case SourceMapProcessingIssueType.PARTIAL_MATCH:
      return [
        {
          title: t('Partial Absolute Path Match'),
          desc: tct(
            'The abs_path of the stack frame is a partial match. The stack frame has the path [absPath] which is a partial match to [partialMatchPath]. You need to update the value for the URL prefix argument or `includes` in your config options to include [urlPrefix]',
            {
              absPath: <code>{error.data.absPath}</code>,
              partialMatchPath: <code>{error.data.partialMatchPath}</code>,
              urlPrefix: <code>{error.data.urlPrefix}</code>,
            }
          ),
          docsLink: getTroubleshootingLink(
            'verify-artifact-names-match-stack-trace-frames'
          ),
        },
      ];
    case SourceMapProcessingIssueType.MISSING_USER_AGENT:
      return [
        {
          title: t('Sentry not part of release pipeline'),
          desc: tct(
            "Integrate Sentry into your release pipeline using  a tool like Webpack or the CLI. Your release must match what's set in your [init]. The value for this event is [version].",
            {
              init: sentryInit,
              version: <code>{error.data.version}</code>,
            }
          ),
          docsLink: defaultDocsLink,
        },
      ];
    case SourceMapProcessingIssueType.MISSING_SOURCEMAPS:
      return [
        {
          title: t('Source Maps not uploaded'),
          desc: t(
            "It looks like you're creating, but not uploading your source maps. Read our docs for troubleshooting help."
          ),
          docsLink: defaultDocsLink,
        },
      ];
    case SourceMapProcessingIssueType.URL_NOT_VALID:
      return [
        {
          title: t('Invalid Absolute Path URL'),
          desc: tct(
            'The [literalAbsPath] of the stack frame is [absPath] which is not a valid URL. Read our docs for troubleshooting help.',
            {
              absPath: <code>{error.data.absPath}</code>,
              literalAbsPath: <code>abs_path</code>,
            }
          ),
          docsLink: getTroubleshootingLink(
            'verify-artifact-names-match-stack-trace-frames'
          ),
        },
      ];
    case SourceMapProcessingIssueType.NO_URL_MATCH:
      return [
        {
          title: t('Absolute Path Mismatch'),
          desc: tct(
            "The given [literalAbsPath] of the stack frame is [absPath] which doesn't match any release artifact. Read our docs for troubleshooting help.",
            {
              absPath: <code>{error.data.absPath}</code>,
              literalAbsPath: <code>abs_path</code>,
            }
          ),
          docsLink: getTroubleshootingLink(
            'verify-artifact-names-match-stack-trace-frames'
          ),
        },
      ];
    case SourceMapProcessingIssueType.DIST_MISMATCH:
      return [
        {
          title: t('Dist Mismatch'),
          desc: tct(
            "The distribution identifier you're providing doesn't match. The [literalDist] value of [dist] configured in your [init] must be the same as the one used during source map upload. Read our docs for troubleshooting help.",
            {
              init: sentryInit,
              dist: <code>dist</code>,
              literalDist: <code>dist</code>,
            }
          ),
          docsLink: getTroubleshootingLink(
            'verify-artifact-distribution-value-matches-value-configured-in-your-sdk'
          ),
        },
      ];
    case SourceMapProcessingIssueType.SOURCEMAP_NOT_FOUND:
      return [
        {
          title: t("Source Map File doesn't exist"),
          desc: t(
            "Sentry couldn't fetch the source map file for this event. Read our docs for troubleshooting help."
          ),
          docsLink: getTroubleshootingLink(),
        },
      ];
    case SourceMapProcessingIssueType.UNKNOWN_ERROR:
    default:
      return [];
  }
}

interface ExpandableErrorListProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  docsLink?: React.ReactNode;
  onExpandClick?: () => void;
}

/**
 * Kinda making this reuseable since we have this pattern in a few places
 */
function ExpandableErrorList({
  title,
  children,
  docsLink,
  onExpandClick,
}: ExpandableErrorListProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <List symbol="bullet">
      <StyledListItem>
        <ErrorTitleFlex>
          <ErrorTitleFlex>
            <strong>{title}</strong>
            {children && (
              <ToggleButton
                priority="link"
                size="zero"
                onClick={() => {
                  setExpanded(!expanded);
                  onExpandClick?.();
                }}
              >
                {expanded ? t('Collapse') : t('Expand')}
              </ToggleButton>
            )}
          </ErrorTitleFlex>
          {docsLink}
        </ErrorTitleFlex>
        {expanded && <div>{children}</div>}
      </StyledListItem>
    </List>
  );
}

function combineErrors(
  response: Array<SourceMapDebugResponse | undefined | null>,
  sdkName?: string
) {
  const combinedErrors = uniqBy(
    response
      .map(res => res?.errors)
      .flat()
      .filter(defined),
    error => error?.type
  );
  const errors = combinedErrors
    .map(error =>
      getErrorMessage(error, sdkName).map(message => ({...message, type: error.type}))
    )
    .flat();

  return errors;
}

interface SourcemapDebugProps {
  /**
   * A subset of the total error frames to validate sourcemaps
   */
  debugFrames: StacktraceFilenameQuery[];
  event: Event;
}

export function SourceMapDebug({debugFrames, event}: SourcemapDebugProps) {
  const sdkName = event.sdk?.name;
  const organization = useOrganization();
  const results = useSourceMapDebugQueries(debugFrames.map(debug => debug.query));

  const isLoading = results.every(result => result.isLoading);
  const errorMessages = combineErrors(
    results.map(result => result.data).filter(defined),
    sdkName
  );

  useRouteAnalyticsParams({
    show_fix_source_map_cta: errorMessages.length > 0,
    source_map_debug_errors: errorMessages.map(error => error.type).join(','),
  });

  if (isLoading || !errorMessages.length) {
    return null;
  }

  const analyticsParams = {
    organization,
    project_id: event.projectID,
    group_id: event.groupID,
    ...getAnalyticsDataForEvent(event),
  };

  const handleDocsClick = (type: SourceMapProcessingIssueType) => {
    trackAdvancedAnalyticsEvent('source_map_debug.docs_link_clicked', {
      ...analyticsParams,
      type,
    });
  };

  const handleExpandClick = (type: SourceMapProcessingIssueType) => {
    trackAdvancedAnalyticsEvent('source_map_debug.expand_clicked', {
      ...analyticsParams,
      type,
    });
  };

  return (
    <Alert
      defaultExpanded
      showIcon
      type="error"
      icon={<IconWarning />}
      expand={
        <Fragment>
          {errorMessages.map((message, idx) => {
            return (
              <ExpandableErrorList
                key={idx}
                title={message.title}
                docsLink={
                  <DocsExternalLink
                    href={message.docsLink}
                    onClick={() => handleDocsClick(message.type)}
                  >
                    {t('Read Guide')}
                  </DocsExternalLink>
                }
                onExpandClick={() => handleExpandClick(message.type)}
              >
                {message.desc}
              </ExpandableErrorList>
            );
          })}
        </Fragment>
      }
    >
      {tn(
        "We've encountered %s problem un-minifying your applications source code!",
        "We've encountered %s problems un-minifying your applications source code!",
        errorMessages.length
      )}
    </Alert>
  );
}

const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(0.75)};
`;

const ToggleButton = styled(Button)`
  color: ${p => p.theme.subText};
  :hover,
  :focus {
    color: ${p => p.theme.textColor};
  }
`;

const ErrorTitleFlex = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
`;

const DocsExternalLink = styled(ExternalLink)`
  white-space: nowrap;
`;
