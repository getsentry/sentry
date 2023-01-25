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
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

import {
  SourceMapDebugResponse,
  SourceMapProcessingIssueType,
  StacktraceFilenameTuple,
  useSourceMapDebug,
} from './useSourceMapDebug';

const errorMessageDescription: Record<
  SourceMapProcessingIssueType,
  Array<{title: string; desc?: string}>
> = {
  [SourceMapProcessingIssueType.UNKNOWN_ERROR]: [
    {
      title: t('x'),
      desc: t('something'),
    },
  ],
  [SourceMapProcessingIssueType.MISSING_RELEASE]: [
    {
      title: tct('Update your [method] call to pass in the release argument', {
        method: 'Sentry.init',
      }),
    },
    {
      title: t(
        'Integration Sentry into your release pipeline. You can do this with a tool like webpack or using the CLI. Not the release must be the same as in step 1.'
      ),
    },
  ],
  [SourceMapProcessingIssueType.MISSING_USER_AGENT]: [
    {
      title: t('x'),
      desc: t('something'),
    },
  ],
  [SourceMapProcessingIssueType.MISSING_SOURCEMAPS]: [
    {
      title: t('x'),
      desc: t('something'),
    },
  ],
  [SourceMapProcessingIssueType.URL_NOT_VALID]: [
    {
      title: t('The abs_path of the stack frame doesn’t match any release artifact'),
      desc: t('something'),
    },
  ],
};

interface SourcemapDebugProps {
  /**
   * A subset of the total error frames to validate sourcemaps
   */
  debugFrames: StacktraceFilenameTuple[];
}

/**
 * Kinda making this reuseable since we have this pattern in a few places
 */
function ExpandableErrorList({
  title,
  children,
  docsLink,
}: {
  children: React.ReactNode;
  docsLink: string;
  title: string;
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
          {docsLink && (
            <DocsExternalLink href={docsLink}>{t('Read Guide')}</DocsExternalLink>
          )}
        </ErrorTitleFlex>

        {expanded && <div>{children}</div>}
      </StyledListItem>
    </List>
  );
}

function combineErrors(response: Array<SourceMapDebugResponse | undefined>) {
  const errors = response
    .map(res => res?.errors ?? [])
    .flat()
    .filter(defined);
  return uniqBy(errors, error => error.type);
}

export function SourceMapDebug({debugFrames}: SourcemapDebugProps) {
  const organization = useOrganization();
  const [firstFrame, secondFrame, thirdFrame] = debugFrames;
  const hasFeature = organization.features.includes('source-maps-cta');
  const {data: firstData} = useSourceMapDebug(firstFrame?.[1], {
    enabled: hasFeature && defined(firstFrame),
  });
  const {data: secondData} = useSourceMapDebug(secondFrame?.[1], {
    enabled: hasFeature && defined(secondFrame),
  });
  const {data: thirdData} = useSourceMapDebug(thirdFrame?.[1], {
    enabled: hasFeature && defined(thirdFrame),
  });

  const errors = combineErrors([firstData, secondData, thirdData]);
  if (!hasFeature || !errors.length) {
    return null;
  }

  const errorMessages = errors.map(error => errorMessageDescription[error.type]).flat();

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
                docsLink="https://example.com"
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
