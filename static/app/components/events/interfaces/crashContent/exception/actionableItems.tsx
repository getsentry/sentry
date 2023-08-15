import React, {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import SourceMapsWizard from 'sentry/components/events/interfaces/crashContent/exception/sourcemapsWizard';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  GenericSchemaErrors,
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
// import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';

import {
  ActionableItems,
  ActionableItemsResponse,
  SourceMapProcessingIssueType,
  useActionableItems,
} from './useActionableItems';
import {sourceMapSdkDocsMap} from './utils';

const shortPathPlatforms = ['javascript', 'node', 'react-native'];
const sentryInit = <code>Sentry.init</code>;

/**
 *
 * TODOs:
 * Add to docs link button :
 *  const handleDocsClick = (type: SourceMapProcessingIssueType) => {
    trackAnalytics('source_map_debug.docs_link_clicked', {
      ...analyticsParams,
      type,
    });
  };
  * Add expand title to all errors
  * Fill in TBDs
  * Add route analytics
  * Add in warning mode
 */

function getErrorMessage(
  error: ActionableItems,
  sdkName?: string
): Array<{
  // Description in expansion
  desc: React.ReactNode;
  title: string;
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
    return (
      `${baseSourceMapDocsLink}troubleshooting_js/legacy-uploading-methods/` +
      (section ? `#${section}` : '')
    );
  }
  const defaultDocsLink = `${baseSourceMapDocsLink}#uploading-source-maps`;

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
    // Need to return something but this does not need to follow the pattern since it uses a different alert
    case SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS:
      return [
        {title: 'Debug Id but no Sourcemaps', desc: 'Try using the Source Maps Wizard'},
      ];
    // Event Errors
    case ProguardProcessingErrors.PROGUARD_MISSING_LINENO:
      return [
        {
          title: t('A proguard mapping file does not contain line info.'),
          desc: t('TBD'),
        },
      ];
    case ProguardProcessingErrors.PROGUARD_MISSING_MAPPING:
      return [
        {
          title: t('A proguard mapping file was missing.'),
          desc: t('TBD'),
        },
      ];
    case NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM:
      return [
        {
          title: t('An optional debug information file was missing.'),
          desc: t('TBD'),
        },
      ];

    case NativeProcessingErrors.NATIVE_MISSING_DSYM:
      return [
        {
          title: t('A required debug information file was missing.'),
          desc: t('TBD'),
        },
      ];
    case NativeProcessingErrors.NATIVE_BAD_DSYM:
      return [
        {
          title: t('The debug information file used was broken.'),
          desc: t('TBD'),
        },
      ];
    case JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTEXT:
      return [
        {
          title: t('TBD'),
          desc: t('TBD'),
        },
      ];
    case HttpProcessingErrors.FETCH_GENERIC_ERROR:
      return [
        {
          title: t('Unable to fetch HTTP resource'),
          desc: t('TBD'),
        },
      ];
    case HttpProcessingErrors.RESTRICTED_IP:
      return [
        {
          title: t('Cannot fetch resource due to restricted IP address'),
          desc: t('TBD'),
        },
      ];
    case HttpProcessingErrors.SECURITY_VIOLATION:
      return [
        {
          title: t('Cannot fetch resource due to security violation'),
          desc: t('TBD'),
        },
      ];
    case GenericSchemaErrors.FUTURE_TIMESTAMP:
      return [
        {
          title: t('Invalid timestamp (in future)'),
          desc: t('TBD'),
        },
      ];

    case GenericSchemaErrors.CLOCK_DRIFT:
      return [
        {
          title: t('Clock drift detected in SDK'),
          desc: t('TBD'),
        },
      ];
    case GenericSchemaErrors.PAST_TIMESTAMP:
      return [
        {
          title: t('Invalid timestamp (too old)'),
          desc: t('TBD'),
        },
      ];
    case GenericSchemaErrors.VALUE_TOO_LONG:
      return [
        {
          title: t('Discarded value due to exceeding maximum length'),
          desc: t('TBD'),
        },
      ];

    case GenericSchemaErrors.INVALID_DATA:
      return [
        {
          title: t('Discarded invalid value'),
          desc: t('TBD'),
        },
      ];
    case GenericSchemaErrors.INVALID_ENVIRONMENT:
      return [
        {
          title: t('Environment cannot contain "/" or newlines'),
          desc: t('TBD'),
        },
      ];
    case GenericSchemaErrors.INVALID_ATTRIBUTE:
      return [
        {
          title: t('Discarded unknown attribute'),
          desc: t('TBD'),
        },
      ];

    default:
      return [];
  }
}

interface ExpandableErrorListProps {
  errorList: any;
  handleExpandClick: any;
  children?: React.ReactNode;
  expandText?: string;
}

function ExpandableErrorList({
  children,
  handleExpandClick,
  expandText,
  errorList,
}: ExpandableErrorListProps) {
  const [expanded, setExpanded] = useState(false);
  const title = errorList[0].title;
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
                  handleExpandClick();
                }}
              >
                {expanded ? t('Collapse') : t('Expand')}
              </ToggleButton>
            )}
          </ErrorTitleFlex>
          <Button> {expandText} </Button>
        </ErrorTitleFlex>
        {expanded && <div>{children}</div>}
      </StyledListItem>
    </List>
  );
}

function groupedErrors(data: ActionableItemsResponse, sdkName?: string) {
  const errors = data.actions
    .map(error =>
      getErrorMessage(error, sdkName).map(message => ({...message, type: error.type}))
    )
    .flat();

  const grouped = errors.reduce((rv, error) => {
    rv[error.type] = rv[error.type] || [];
    rv[error.type].push(error);
    return rv;
  }, Object.create(null));

  return grouped;
}

interface ActionableItemsProps {
  event: Event;
}

export function SourceMapDebug({event}: ActionableItemsProps) {
  const sdkName = event.sdk?.name;
  const organization = useOrganization();
  const {data, isLoading} = useActionableItems({
    eventId: event.id,
    orgSlug: organization.slug,
    projectSlug: event.projectSlug || '',
  });

  if (isLoading || !defined(data)) {
    return null;
  }

  const errorMessages = groupedErrors(data, sdkName);

  const analyticsParams = {
    organization,
    project_id: event.projectID,
    group_id: event.groupID,
    ...getAnalyticsDataForEvent(event),
  };

  const handleExpandClick = (type: SourceMapProcessingIssueType) => {
    trackAnalytics('source_map_debug.expand_clicked', {
      ...analyticsParams,
      type,
    });
  };

  if (
    errorMessages.SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS &&
    errorMessages.SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS.length > 0
  ) {
    return <SourceMapsWizard analyticsParams={analyticsParams} />;
  }

  return (
    <Alert
      defaultExpanded
      showIcon
      type="error"
      expand={
        <Fragment>
          {errorMessages.map((errorList, idx) => {
            return (
              <ExpandableErrorList
                key={idx}
                errorList={errorList}
                handleExpandClick={handleExpandClick}
              >
                {errorList[0].desc}
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
