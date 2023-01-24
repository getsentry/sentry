import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Event, ExceptionValue, Frame} from 'sentry/types';
import {defined} from 'sentry/utils';
import {QueryKey, useQuery, UseQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseSourcemapDebugProps {
  event: Event;
  exceptionIdx: number;
  frameIdx: number;
  orgSlug: string;
  projectSlug: string | undefined;
}

interface SourcemapDebugResponse {
  errors: SourceMapProcessingIssueResponse[];
}

enum SourceMapProcessingIssueType {
  UNKNOWN_ERROR = 'unknown_error',
  MISSING_RELEASE = 'no_release_on_event',
  MISSING_USER_AGENT = 'no_user_agent_on_release',
  MISSING_SOURCEMAPS = 'no_sourcemaps_on_release',
  URL_NOT_VALID = 'url_not_valid',
}

interface SourceMapProcessingIssueResponse {
  data: {message: string; type: SourceMapProcessingIssueType} | null;
  message: string;
  type: string;
}

type StacktraceFilenameTuple = [filename: string, frameIdx: number, exceptionIdx: number];

// TODO: Types
const errorMessageDescription = {
  [SourceMapProcessingIssueType.URL_NOT_VALID]: t(
    'The abs_path of the stack frame doesn’t match any release artifact'
  ),
};

/**
 * Returns an array of unique filenames and the first frame they appear in.
 * Filters out non inApp frames and frames without a line number.
 * Limited to only the first 3 unique filenames.
 */
export function getUnqiueFilesFromExcption(
  excValues: ExceptionValue[]
): StacktraceFilenameTuple[] {
  // Not using .at(-1) because we need to use the index later
  const exceptionIdx = excValues.length - 1;
  const fileFrame = (excValues[exceptionIdx]?.stacktrace?.frames ?? [])
    .map<[Frame, number]>((frame, idx) => [frame, idx])
    .filter(
      ([frame]) =>
        frame.inApp &&
        frame.filename &&
        // Line number might not work for non-javascript languages
        defined(frame.lineNo)
    )
    .map<StacktraceFilenameTuple>(([frame, idx]) => [frame.filename!, idx, exceptionIdx]);

  return uniqBy(fileFrame, ([filename]) => filename).slice(0, 3);
}

const sourceMapDebugQuery = (
  orgSlug: string,
  projectSlug: string | undefined,
  eventId: Event['id'],
  query: Record<string, string>
): QueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/source-map-debug/`,
  {query},
];

function useSourceMapDebug(
  {event, orgSlug, projectSlug, frameIdx, exceptionIdx}: UseSourcemapDebugProps,
  options: Partial<UseQueryOptions<SourcemapDebugResponse>> = {}
) {
  return useQuery<SourcemapDebugResponse>(
    sourceMapDebugQuery(orgSlug, projectSlug, event.id, {
      frame_idx: `${frameIdx}`,
      exception_idx: `${exceptionIdx}`,
    }),
    {
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}

interface SourcemapDebugProps {
  debugFrames: StacktraceFilenameTuple[];
  event: Event;
  projectSlug: string | undefined;
}

function SourceErrorDescription({
  title,
  expandedMessage,
  docsLink,
}: {
  docsLink: string;
  expandedMessage: string;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <List symbol="bullet">
      <StyledListItem>
        <ErrorTitleFlex>
          <ErrorTitleFlex>
            <strong>{title}</strong>
            {expandedMessage && (
              <ToggleButton
                priority="link"
                size="zero"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? t('Collapse') : t('Expand')}
              </ToggleButton>
            )}
          </ErrorTitleFlex>
          {docsLink && <ExternalLink href={docsLink}>{t('Read Guide')}</ExternalLink>}
        </ErrorTitleFlex>

        {expanded && <div>{expandedMessage}</div>}
      </StyledListItem>
    </List>
  );
}

export function SourceMapDebug({event, projectSlug, debugFrames}: SourcemapDebugProps) {
  const organization = useOrganization();
  const enabled = organization.features.includes('source-maps-cta');
  // TODO: Support multiple frames
  const [firstFrame] = debugFrames;
  const {data, isLoading} = useSourceMapDebug(
    {
      event,
      orgSlug: organization.slug,
      projectSlug,
      frameIdx: firstFrame[1],
      exceptionIdx: firstFrame[2],
    },
    {enabled: enabled && defined(firstFrame)}
  );

  if (isLoading || !enabled) {
    return null;
  }

  const errors = data?.errors ?? [];

  return (
    <Alert
      type="error"
      showIcon
      icon={<IconWarning />}
      expand={
        <Fragment>
          {errors.map(error => (
            <SourceErrorDescription
              key={error.type}
              title={error.message}
              expandedMessage={errorMessageDescription[error.type] ?? ''}
              docsLink="https://example.com"
            />
          ))}
        </Fragment>
      }
    >
      {tn(
        'We’ve encountered %s problem de-minifying your applications source code!',
        'We’ve encountered %s problems de-minifying your applications source code!',
        errors.length
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
