import React, {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import SourceMapsWizard from 'sentry/components/events/interfaces/crashContent/exception/sourcemapsWizard';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  GenericSchemaErrors,
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';

import {
  ActionableItems,
  ActionableItemsResponse,
  ActionableItemTypes,
  ActionableItemWarning,
  SourceMapProcessingIssueType,
  useActionableItems,
} from './useActionableItems';
import {sourceMapSdkDocsMap} from './utils';

const shortPathPlatforms = ['javascript', 'node', 'react-native'];
const sentryInit = <code>Sentry.init</code>;

interface ErrorMessage {
  desc: React.ReactNode;
  expandTitle: string;
  title: string;
  data?: {
    absPath?: string;
    image_path?: string;
    mage_name?: string;
    message?: string;
    name?: string;
    partialMatchPath?: string;
    sdk_time?: string;
    server_time?: string;
    url?: string;
    urlPrefix?: string;
  } & Record<string, any>;
}

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

function getErrorMessage(
  error: ActionableItems,
  event: Event,
  organization: Organization,
  sdkName?: string
): Array<ErrorMessage> {
  const docPlatform = (sdkName && sourceMapSdkDocsMap[sdkName]) ?? 'javascript';
  const useShortPath = shortPathPlatforms.includes(docPlatform);

  const analyticsParams = {
    organization,
    project_id: event.projectID,
    group_id: event.groupID,
    ...getAnalyticsDataForEvent(event),
  };

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
  const docsLink = (type: ActionableItemTypes, link: string) => {
    return (
      <ExternalLink
        onClick={() => {
          trackAnalytics('actionable_items.docs_link_clicked', {
            ...analyticsParams,
            type,
          });
        }}
        openInNewTab
        href={link}
      />
    );
  };

  `${baseSourceMapDocsLink}#uploading-source-maps`;
  const sourcemapTitle = t('Fix Source Maps');
  const errorData = error.data ?? {};

  switch (error.type) {
    case SourceMapProcessingIssueType.MISSING_RELEASE:
      return [
        {
          title: t('Event missing Release tag'),
          desc: tct(
            'Integrate Sentry into your release pipeline using a tool like the Sentry Webpack plugin or Sentry CLI. Read our docs for [link:more information].',
            {
              link: docsLink(error.type, defaultDocsLink),
            }
          ),
          expandTitle: sourcemapTitle,
          data: errorData,
        },
      ];
    case SourceMapProcessingIssueType.PARTIAL_MATCH:
      return [
        {
          title: t('Partial Absolute Path Match'),
          desc: tct(
            'The stack frame has an absolute path which is a partial match. You need to update the value for the URL prefix argument or `includes` in your config options to include the URL prefix. Read our docs for [link:more information].',
            {
              link: docsLink(
                error.type,
                getTroubleshootingLink('verify-artifact-names-match-stack-trace-frames')
              ),
            }
          ),
          expandTitle: sourcemapTitle,
          data: errorData,
        },
      ];
    case SourceMapProcessingIssueType.MISSING_SOURCEMAPS:
      return [
        {
          title: t('Source Maps not uploaded'),
          desc: tct(
            "It looks like you're creating, but not uploading your source maps. Read our docs for [link:troubleshooting help].",
            {link: docsLink(error.type, defaultDocsLink)}
          ),
          expandTitle: sourcemapTitle,
          data: errorData,
        },
      ];
    case SourceMapProcessingIssueType.URL_NOT_VALID:
      return [
        {
          title: t('Invalid Absolute Path URL'),
          desc: tct(
            'The [literalAbsPath] of the stack frame is not a valid URL. Read our docs for [link:troubleshooting help].',
            {
              literalAbsPath: <code>abs_path</code>,
              link: docsLink(
                error.type,
                getTroubleshootingLink('verify-artifact-names-match-stack-trace-frames')
              ),
            }
          ),
          expandTitle: sourcemapTitle,
          data: errorData,
        },
      ];
    case SourceMapProcessingIssueType.NO_URL_MATCH:
      return [
        {
          title: t('Absolute Path Mismatch'),
          desc: tct(
            "The given [literalAbsPath] of the stack frame doesn't match any uploaded source maps. Read our docs for [link: troubleshooting help].",
            {
              literalAbsPath: <code>abs_path</code>,
              link: docsLink(
                error.type,
                getTroubleshootingLink('verify-artifact-names-match-stack-trace-frames')
              ),
            }
          ),
          expandTitle: sourcemapTitle,
          data: errorData,
        },
      ];
    case SourceMapProcessingIssueType.DIST_MISMATCH:
      return [
        {
          title: t('Dist Mismatch'),
          desc: tct(
            'The [literalDist] value configured in your [init] must be the same as the one used during source map upload. Read our docs for [link: troubleshooting help].',
            {
              init: sentryInit,
              literalDist: <code>dist</code>,
              link: docsLink(
                error.type,
                getTroubleshootingLink(
                  'verify-artifact-distribution-value-matches-value-configured-in-your-sdk'
                )
              ),
            }
          ),
          expandTitle: sourcemapTitle,
          data: errorData,
        },
      ];
    case SourceMapProcessingIssueType.SOURCEMAP_NOT_FOUND:
      return [
        {
          title: t("Source Map File doesn't exist"),
          desc: tct(
            "Sentry couldn't fetch the source map file for this event. Read our docs for [link: troubleshooting help].",
            {link: docsLink(error.type, getTroubleshootingLink())}
          ),
          expandTitle: sourcemapTitle,
          data: errorData,
        },
      ];
    // Need to return something but this does not need to follow the pattern since it uses a different alert
    case SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS:
      return [
        {
          title: 'Debug Id but no Sourcemaps',
          desc: 'Try using the Source Maps Wizard',
          expandTitle: sourcemapTitle,
        },
      ];
    // Event Errors
    case ProguardProcessingErrors.PROGUARD_MISSING_LINENO:
      return [
        {
          title: t('A proguard mapping file does not contain line info'),
          desc: null,
          expandTitle: t('Fix Proguard Processing Error'),
          data: errorData,
        },
      ];
    case ProguardProcessingErrors.PROGUARD_MISSING_MAPPING:
      return [
        {
          title: t('A proguard mapping file was missing'),
          desc: null,
          expandTitle: t('Fix Proguard Processing Error'),
          data: errorData,
        },
      ];
    case NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM:
      return [
        {
          title: t('An optional debug information file was missing'),
          desc: null,
          expandTitle: t('Fix Native Processing Error'),
          data: errorData,
        },
      ];

    case NativeProcessingErrors.NATIVE_MISSING_DSYM:
      return [
        {
          title: t('A required debug information file was missing'),
          desc: null,
          expandTitle: t('Fix Native Processing Error'),
          data: errorData,
        },
      ];
    case NativeProcessingErrors.NATIVE_BAD_DSYM:
      return [
        {
          title: t('The debug information file used was broken'),
          desc: null,
          expandTitle: t('Fix Native Processing Error'),
          data: errorData,
        },
      ];
    case JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTEXT:
      return [
        {
          title: t('Missing Sources Context'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case HttpProcessingErrors.FETCH_GENERIC_ERROR:
      return [
        {
          title: t('Unable to fetch HTTP resource'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case HttpProcessingErrors.RESTRICTED_IP:
      return [
        {
          title: t('Cannot fetch resource due to restricted IP address'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case HttpProcessingErrors.SECURITY_VIOLATION:
      return [
        {
          title: t('Cannot fetch resource due to security violation'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case GenericSchemaErrors.FUTURE_TIMESTAMP:
      return [
        {
          title: t('Invalid timestamp (in future)'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];

    case GenericSchemaErrors.CLOCK_DRIFT:
      return [
        {
          title: t('Clock drift detected in SDK'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case GenericSchemaErrors.PAST_TIMESTAMP:
      return [
        {
          title: t('Invalid timestamp (too old)'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case GenericSchemaErrors.VALUE_TOO_LONG:
      return [
        {
          title: t('Discarded value due to exceeding maximum length'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];

    case GenericSchemaErrors.INVALID_DATA:
      return [
        {
          title: t('Discarded invalid value'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case GenericSchemaErrors.INVALID_ENVIRONMENT:
      return [
        {
          title: t('Environment cannot contain "/" or newlines'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];
    case GenericSchemaErrors.INVALID_ATTRIBUTE:
      return [
        {
          title: t('Discarded unknown attribute'),
          desc: null,
          expandTitle: t('Fix Processing Error'),
          data: errorData,
        },
      ];

    default:
      return [];
  }
}

interface ExpandableErrorListProps {
  errorList: ErrorMessageType[];
  handleExpandClick: (type: ActionableItemTypes) => void;
}

function ExpandableErrorList({handleExpandClick, errorList}: ExpandableErrorListProps) {
  const [expanded, setExpanded] = useState(false);
  const firstError = errorList[0];
  const {title, desc, expandTitle, type} = firstError;
  const numErrors = errorList.length;
  const errorDataList = errorList.map(error => error.data ?? {});

  const cleanedData = useMemo(() => {
    const cleaned = errorDataList.map(errorData => {
      const data = {...errorData};
      // The name is rendered as path in front of the message
      if (typeof data.name === 'string') {
        delete data.name;
      }

      if (data.message === 'None') {
        // Python ensures a message string, but "None" doesn't make sense here
        delete data.message;
      }

      if (typeof data.image_path === 'string') {
        // Separate the image name for readability
        const separator = /^([a-z]:\\|\\\\)/i.test(data.image_path) ? '\\' : '/';
        const path = data.image_path.split(separator);
        data.image_name = path.splice(-1, 1)[0];
        data.image_path = path.length ? path.join(separator) + separator : '';
      }

      if (typeof data.server_time === 'string' && typeof data.sdk_time === 'string') {
        data.message = t(
          'Adjusted timestamps by %s',
          moment
            .duration(moment.utc(data.server_time).diff(moment.utc(data.sdk_time)))
            .humanize()
        );
      }

      return Object.entries(data)
        .map(([key, value]) => ({
          key,
          value,
          subject: keyMapping[key] || startCase(key),
        }))
        .filter(d => {
          if (!d.value) {
            return true;
          }
          return !!d.value;
        });
    });
    return cleaned;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorDataList]);

  return (
    <List symbol="bullet">
      <StyledListItem>
        <ErrorTitleFlex>
          <strong>
            {title} ({numErrors})
          </strong>
          <ToggleButton
            priority="link"
            size="zero"
            onClick={() => {
              setExpanded(!expanded);
              handleExpandClick(type);
            }}
          >
            {expandTitle}
          </ToggleButton>
        </ErrorTitleFlex>
        {expanded && (
          <div>
            {desc && <Description>{desc}</Description>}
            {cleanedData.map((data, idx) => {
              return (
                <div key={idx}>
                  <KeyValueList data={data} isContextData />
                  {idx !== numErrors - 1 && <hr />}
                </div>
              );
            })}
          </div>
        )}
      </StyledListItem>
    </List>
  );
}

interface ErrorMessageType extends ErrorMessage {
  type: ActionableItemTypes;
}

function groupedErrors(
  event: Event,
  organization: Organization,
  data?: ActionableItemsResponse,
  sdkName?: string
): Record<ActionableItemTypes, ErrorMessageType[]> | {} {
  if (!data) {
    return {};
  }
  const errors = data.errors
    .map(error =>
      getErrorMessage(error, event, organization, sdkName).map(message => ({
        ...message,
        type: error.type,
      }))
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
  projectSlug: string;
}

export function ActionableItem({event, projectSlug}: ActionableItemsProps) {
  const sdkName = event.sdk?.name;
  const organization = useOrganization();
  const {data, isLoading} = useActionableItems({
    eventId: event.id,
    orgSlug: organization.slug,
    projectSlug,
  });

  const errorMessages = groupedErrors(event, organization, data, sdkName);

  useRouteAnalyticsParams({
    show_actionable_items_cta: data ? data.errors.length > 0 : false,
    actionable_items: data ? Object.keys(errorMessages) : [],
  });

  if (isLoading || !defined(data) || data.errors.length === 0) {
    return null;
  }

  const analyticsParams = {
    organization,
    project_id: event.projectID,
    group_id: event.groupID,
    ...getAnalyticsDataForEvent(event),
  };

  const handleExpandClick = (type: ActionableItemTypes) => {
    trackAnalytics('actionable_items.expand_clicked', {
      ...analyticsParams,
      type,
    });
  };

  if (
    errorMessages[SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS] &&
    errorMessages[SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS].length > 0
  ) {
    return <SourceMapsWizard analyticsParams={analyticsParams} />;
  }

  const hasErrorAlert = Object.keys(errorMessages).some(error =>
    ActionableItemWarning.includes(
      error as ProguardProcessingErrors | NativeProcessingErrors | GenericSchemaErrors
    )
  );

  for (const errorKey in Object.keys(errorMessages)) {
    const isWarning = ActionableItemWarning.includes(
      errorKey as ProguardProcessingErrors | NativeProcessingErrors | GenericSchemaErrors
    );
    const shouldDelete = hasErrorAlert ? isWarning : !isWarning;

    if (shouldDelete) {
      delete errorMessages[errorKey];
    }
  }

  return (
    <StyledAlert
      defaultExpanded
      showIcon
      type={hasErrorAlert ? 'error' : 'warning'}
      expand={
        <Fragment>
          {Object.keys(errorMessages).map((error, idx) => {
            return (
              <ExpandableErrorList
                key={idx}
                errorList={errorMessages[error]}
                handleExpandClick={handleExpandClick}
              />
            );
          })}
        </Fragment>
      }
    >
      {t("There are problems you'll need to fix for future events")}
    </StyledAlert>
  );
}

const Description = styled('div')`
  margin-top: ${space(0.5)};
`;
const StyledAlert = styled(Alert)`
  margin: 0 30px;
`;
const StyledListItem = styled(ListItem)`
  margin-bottom: ${space(0.75)};
`;

const ToggleButton = styled(Button)`
  color: ${p => p.theme.subText};
  text-decoration: underline;

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
