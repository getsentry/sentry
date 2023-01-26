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
import useOrganization from 'sentry/utils/useOrganization';

import {
  SourceMapDebugResponse,
  SourceMapProcessingIssueType,
  StacktraceFilenameQuery,
  useSourceMapDebug,
} from './useSourceMapDebug';

const platformDocsMap = {
  'javascript-ember': 'ember',
  'javascript-gatsby': 'gatsby',
  'javascript-nextjs': 'nextjs',
  'javascript-react': 'react',
  'javascript-remix': 'remix',
  'javascript-svelte': 'svelte',
  'javascript-vue': 'vue',
};

const errorMessageDescription: Record<
  SourceMapProcessingIssueType,
  (
    data: Record<string, string>,
    platform: PlatformType
  ) => Array<{
    title: string;
    /**
     * Expandable description
     */
    desc?: string;
    docsLink?: string;
  }>
> = {
  [SourceMapProcessingIssueType.UNKNOWN_ERROR]: () => [
    {
      title: t('UNKNOWN_ERROR'),
    },
  ],
  // This error has two messages
  [SourceMapProcessingIssueType.MISSING_RELEASE]: (_data, platform) => [
    {
      title: tct('Update your [method] call to pass in the release argument', {
        // Make sure method isn't translated
        method: 'Sentry.init',
      }),
      docsLink:
        platform === 'javascript'
          ? 'https://docs.sentry.io/platforms/javascript/configuration/options/#release'
          : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/configuration/options/#release`,
    },
    {
      title: t(
        'Integrate Sentry into your release pipeline. You can do this with a tool like webpack or using the CLI. Not the release must be the same as in step 1.'
      ),
      docsLink:
        platform === 'javascript'
          ? 'https://docs.sentry.io/platforms/javascript/sourcemaps/#uploading-source-maps-to-sentry'
          : `https://docs.sentry.io/platforms/javascript/guides/${platformDocsMap[platform]}/sourcemaps/#uploading-source-maps-to-sentry`,
    },
  ],
  [SourceMapProcessingIssueType.MISSING_USER_AGENT]: () => [
    {
      title: t('MISSING_USER_AGENT'),
    },
  ],
  [SourceMapProcessingIssueType.MISSING_SOURCEMAPS]: () => [
    {
      title: t('MISSING_SOURCEMAPS'),
    },
  ],
  [SourceMapProcessingIssueType.URL_NOT_VALID]: () => [
    {
      title: tct('The [absPath] of the stack frame doesn’t match any release artifact', {
        absPath: <code>abs_path</code>,
      }),
    },
  ],
};

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
  const errors = combinedErrors
    .map(error => {
      return errorMessageDescription[error.type]?.(error.data, platform).map(message => ({
        ...message,
        type: error.type,
      }));
    })
    .flat()
    .filter(defined);

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
  const [firstFrame, secondFrame, thirdFrame] = debugFrames;
  const hasFeature = organization?.features?.includes('fix-source-map-cta');
  const queryOptions = {enabled: hasFeature};
  const {data: firstData} = useSourceMapDebug(firstFrame?.query, queryOptions);
  const {data: secondData} = useSourceMapDebug(secondFrame?.query, queryOptions);
  const {data: thirdData} = useSourceMapDebug(thirdFrame?.query, queryOptions);

  const errorMessages = combineErrors([firstData, secondData, thirdData], platform);
  if (!hasFeature || !errorMessages.length) {
    return null;
  }

  return (
    <Alert
      type="error"
      showIcon
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
