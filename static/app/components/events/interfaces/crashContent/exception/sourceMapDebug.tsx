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
import space from 'sentry/styles/space';
import type {PlatformType} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';

import {
  SourceMapDebugError,
  SourceMapDebugResponse,
  SourceMapProcessingIssueType,
  StacktraceFilenameQuery,
  useSourceMapDebugQueries,
} from './useSourceMapDebug';

const platformDocsMap: Record<string, string> = {
  javascript: 'javascript',
  node: 'node',
  'javascript-react': 'react',
  'javascript-angular': 'angular',
  // Sending angularjs to angular docs since it's not supported, has limited docs
  'javascript-angularjs': 'angular',
  // Sending backbone to javascript docs since it's not supported
  'javascript-backbone': 'javascript',
  'javascript-ember': 'ember',
  'javascript-gatsby': 'gatsby',
  'javascript-vue': 'vue',
  'javascript-nextjs': 'nextjs',
  'javascript-remix': 'remix',
  'javascript-svelte': 'svelte',
};

const shortPathPlatforms = ['javascript', 'node'];

function getErrorMessage(
  error: SourceMapDebugError,
  platform: PlatformType
): Array<{
  title: string;
  /**
   * Expandable description
   */
  desc?: string;
  docsLink?: string;
}> {
  const docPlatform = platformDocsMap[platform] ?? 'javascript';
  const useShortPath = shortPathPlatforms.includes(docPlatform);

  switch (error.type) {
    case SourceMapProcessingIssueType.MISSING_RELEASE:
      return [
        {
          title: tct('Update your [init] call to pass in the release argument', {
            init: <code>Sentry.init</code>,
          }),
          docsLink: useShortPath
            ? `https://docs.sentry.io/platforms/${docPlatform}/configuration/options/#release`
            : `https://docs.sentry.io/platforms/javascript/guides/${docPlatform}/configuration/options/#release`,
        },
        {
          title: t(
            'Integrate Sentry into your release pipeline. You can do this with a tool like webpack or using the CLI. Not the release must be the same as in step 1.'
          ),
          docsLink: useShortPath
            ? `https://docs.sentry.io/platforms/${docPlatform}/sourcemaps/#uploading-source-maps-to-sentry`
            : `https://docs.sentry.io/platforms/javascript/guides/${docPlatform}/sourcemaps/#uploading-source-maps-to-sentry`,
        },
      ];
    case SourceMapProcessingIssueType.PARTIAL_MATCH:
      return [
        {
          title: t(
            'The abs_path of the stack frame is a partial match. The stack frame has the path %s which is a partial match to %s. You might need to modify the value of url-prefix.',
            error.data.insertPath,
            error.data.matchedSourcemapPath
          ),
          docsLink: useShortPath
            ? `https://docs.sentry.io/platforms/${docPlatform}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`
            : `https://docs.sentry.io/platforms/javascript/guides/${docPlatform}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`,
        },
      ];
    case SourceMapProcessingIssueType.MISSING_USER_AGENT:
      return [
        {
          title: t('Event has Release but no User-Agent'),
          desc: tct(
            'Integrate Sentry into your release pipeline. You can do this with a tool like Webpack or using the CLI. Please note the release must be the same as being set in your [init]. The value for this event is [version]',
            {
              init: <code>Sentry.init</code>,
              version: error.data.version,
            }
          ),
          docsLink: useShortPath
            ? `https://docs.sentry.io/platforms/${docPlatform}/sourcemaps/#uploading-source-maps-to-sentry`
            : `https://docs.sentry.io/platforms/javascript/guides/${docPlatform}/sourcemaps/#uploading-source-maps-to-sentry`,
        },
      ];
    case SourceMapProcessingIssueType.MISSING_SOURCEMAPS:
      return [
        {
          title: t('Source Maps not uploaded'),
          desc: t(
            'It looks like you are creating but not uploading your source maps. Please refer to the instructions in our docs guide for help with troubleshooting the issue.'
          ),
          docsLink: useShortPath
            ? `https://docs.sentry.io/platforms/${docPlatform}/sourcemaps/`
            : `https://docs.sentry.io/platforms/javascript/guides/${docPlatform}/sourcemaps/`,
        },
      ];
    case SourceMapProcessingIssueType.URL_NOT_VALID:
      return [
        {
          title: t('Invalid Absolute Path URL'),
          desc: tct(
            'The abs_path of the stack frame has [absValue] which is not a valid URL. Please refer to the instructions in our docs guide for help with troubleshooting the issue.',
            {absValue: <code>{error.data.absValue}</code>}
          ),
          docsLink: useShortPath
            ? `https://docs.sentry.io/platforms/${docPlatform}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`
            : `https://docs.sentry.io/platforms/javascript/guides/${docPlatform}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`,
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
  platform: PlatformType
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
      getErrorMessage(error, platform).map(message => ({...message, type: error.type}))
    )
    .flat();

  return errors;
}

interface SourcemapDebugProps {
  /**
   * A subset of the total error frames to validate sourcemaps
   */
  debugFrames: StacktraceFilenameQuery[];
  platform: PlatformType;
}

export function SourceMapDebug({debugFrames, platform}: SourcemapDebugProps) {
  const organization = useOrganization();
  const results = useSourceMapDebugQueries(debugFrames.map(debug => debug.query));

  const isLoading = results.every(result => result.isLoading);
  const errorMessages = combineErrors(
    results.map(result => result.data).filter(defined),
    platform
  );

  useRouteAnalyticsParams({
    show_fix_source_map_cta: errorMessages.length > 0,
  });

  if (isLoading || !errorMessages.length) {
    return null;
  }

  const handleDocsClick = (type: SourceMapProcessingIssueType) => {
    trackAdvancedAnalyticsEvent('growth.sourcemap_docs_clicked', {
      organization,
      platform,
      type,
    });
  };

  const handleExpandClick = (type: SourceMapProcessingIssueType) => {
    trackAdvancedAnalyticsEvent('growth.sourcemap_expand_clicked', {
      organization,
      platform,
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
        'We’ve encountered %s problem de-minifying your applications source code!',
        'We’ve encountered %s problems de-minifying your applications source code!',
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
