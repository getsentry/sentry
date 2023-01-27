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

import {
  SourceMapDebugError,
  SourceMapDebugResponse,
  SourceMapProcessingIssueType,
  StacktraceFilenameQuery,
  useSourceMapDebugQueries,
} from './useSourceMapDebug';

const platformDocsMap = {
  'javascript-react': 'react',
  'javascript-angular': 'angular',
  'javascript-angularjs': 'angularjs',
  'javascript-backbone': 'backbone',
  'javascript-ember': 'ember',
  'javascript-gatsby': 'gatsby',
  'javascript-vue': 'vue',
  'javascript-nextjs': 'nextjs',
  'javascript-remix': 'remix',
  'javascript-svelte': 'svelte',
};

const shortPath = ['javascript', 'node'];

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
  switch (error.type) {
    case SourceMapProcessingIssueType.MISSING_RELEASE:
      return [
        {
          title: tct('Update your [init] call to pass in the release argument', {
            init: <code>Sentry.init</code>,
          }),
          docsLink: shortPath.includes(platform)
            ? `https://docs.sentry.io/platforms/${platform}/configuration/options/#release`
            : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/configuration/options/#release`,
        },
        {
          title: t(
            'Integrate Sentry into your release pipeline. You can do this with a tool like webpack or using the CLI. Not the release must be the same as in step 1.'
          ),
          docsLink: shortPath.includes(platform)
            ? `https://docs.sentry.io/platforms/${platform}/sourcemaps/#uploading-source-maps-to-sentry`
            : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/sourcemaps/#uploading-source-maps-to-sentry`,
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
          docsLink: shortPath.includes(platform)
            ? `https://docs.sentry.io/platforms/${platform}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`
            : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`,
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
          docsLink: shortPath.includes(platform)
            ? `https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps-to-sentry`
            : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/sourcemaps/#uploading-source-maps-to-sentry`,
        },
      ];
    case SourceMapProcessingIssueType.MISSING_SOURCEMAPS:
      return [
        {
          title: t('Source Maps not uploaded'),
          desc: t(
            'It looks like you are creating but not uploading your source maps. Please refer to the instructions in our docs guide for help with troubleshooting the issue.'
          ),
          docsLink: shortPath.includes(platform)
            ? `https://docs.sentry.io/platforms/${platform}/sourcemaps/`
            : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/sourcemaps/`,
        },
      ];
    case SourceMapProcessingIssueType.URL_NOT_VALID:
      return [
        {
          title: t('Invalid Absolute Path URL'),
          desc: t(
            'The abs_path of the stack frame has %s which is not a valid URL. Please refer to the instructions in our docs guide for help with troubleshooting the issue.',
            error.data.absValue
          ),
          docsLink: shortPath.includes(platform)
            ? `https://docs.sentry.io/platforms/${platform}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`
            : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`,
        },
      ];
    case SourceMapProcessingIssueType.UNKNOWN_ERROR:
    default:
      return [];
  }
}

/**
 * Kinda making this reuseable since we have this pattern in a few places
 */
function ExpandableErrorList({
  title,
  children,
  docsLink,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  docsLink?: React.ReactNode;
}) {
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
                onClick={() => setExpanded(!expanded)}
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
  const errors = combinedErrors.map(error => getErrorMessage(error, platform)).flat();

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
  const results = useSourceMapDebugQueries(debugFrames.map(debug => debug.query));

  if (!results.every(result => !result.isLoading)) {
    return null;
  }
  const errorMessages = combineErrors(
    results.map(result => result.data).filter(defined),
    platform
  );
  if (!errorMessages.length) {
    return null;
  }

  return (
    <Alert
      startExpanded
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
                  <DocsExternalLink href={message.docsLink}>
                    {t('Read Guide')}
                  </DocsExternalLink>
                }
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
