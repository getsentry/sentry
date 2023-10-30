import React, {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {EventErrorData} from 'sentry/components/events/errorItem';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {
  GenericSchemaErrors,
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';

import {
  ActionableItemErrors,
  ActionableItemTypes,
  ActionableItemWarning,
  shouldErrorBeShown,
  useFetchProguardMappingFiles,
} from './actionableItemsUtils';
import {ActionableItemsResponse, useActionableItems} from './useActionableItems';

interface ErrorMessage {
  desc: React.ReactNode;
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
  meta?: Record<string, any>;
}

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

function getErrorMessage(
  error: ActionableItemErrors | EventErrorData,
  meta?: Record<string, any>
): Array<ErrorMessage> {
  const errorData = error.data ?? {};
  const metaData = meta ?? {};
  switch (error.type) {
    // Event Errors
    case ProguardProcessingErrors.PROGUARD_MISSING_LINENO:
      return [
        {
          title: t('A proguard mapping file does not contain line info'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case ProguardProcessingErrors.PROGUARD_MISSING_MAPPING:
      return [
        {
          title: t('A proguard mapping file was missing'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM:
      return [
        {
          title: t('An optional debug information file was missing'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];

    case NativeProcessingErrors.NATIVE_MISSING_DSYM:
      return [
        {
          title: t('A required debug information file was missing'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case NativeProcessingErrors.NATIVE_BAD_DSYM:
      return [
        {
          title: t('The debug information file used was broken'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT:
      return [
        {
          title: t('Missing Sources Context'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case HttpProcessingErrors.FETCH_GENERIC_ERROR:
      return [
        {
          title: t('Unable to fetch HTTP resource'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case HttpProcessingErrors.RESTRICTED_IP:
      return [
        {
          title: t('Cannot fetch resource due to restricted IP address'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case HttpProcessingErrors.SECURITY_VIOLATION:
      return [
        {
          title: t('Cannot fetch resource due to security violation'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case GenericSchemaErrors.FUTURE_TIMESTAMP:
      return [
        {
          title: t('Invalid timestamp (in future)'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];

    case GenericSchemaErrors.CLOCK_DRIFT:
      return [
        {
          title: t('Clock drift detected in SDK'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case GenericSchemaErrors.PAST_TIMESTAMP:
      return [
        {
          title: t('Invalid timestamp (too old)'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case GenericSchemaErrors.VALUE_TOO_LONG:
      return [
        {
          title: t('Discarded value due to exceeding maximum length'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];

    case GenericSchemaErrors.INVALID_DATA:
      return [
        {
          title: t('Discarded invalid value'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case GenericSchemaErrors.INVALID_ENVIRONMENT:
      return [
        {
          title: t('Environment cannot contain "/" or newlines'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case GenericSchemaErrors.INVALID_ATTRIBUTE:
      return [
        {
          title: t('Discarded unknown attribute'),
          desc: null,
          data: errorData,
          meta: metaData,
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
  const {title, desc, type} = firstError;
  const numErrors = errorList.length;
  const errorDataList = errorList.map(error => error.data ?? {});

  const cleanedData = useMemo(() => {
    const cleaned = errorDataList.map(errorData => {
      const data = {...errorData};

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
            {expanded ? t('Collapse') : t('Expand')}
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
  data?: ActionableItemsResponse,
  progaurdErrors?: EventErrorData[]
): Record<ActionableItemTypes, ErrorMessageType[]> | {} {
  if (!data || !progaurdErrors || !event) {
    return {};
  }
  const {_meta} = event;
  const errors = [...data.errors, ...progaurdErrors]
    .filter(error => shouldErrorBeShown(error, event))
    .map((error, errorIdx) =>
      getErrorMessage(error, _meta?.errors?.[errorIdx]).map(message => ({
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
  isShare: boolean;
  project: Project;
}

export function ActionableItems({event, project, isShare}: ActionableItemsProps) {
  const organization = useOrganization();
  const {data, isLoading} = useActionableItems({
    eventId: event.id,
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const {proguardErrorsLoading, proguardErrors} = useFetchProguardMappingFiles({
    event,
    project,
    isShare,
  });

  useEffect(() => {
    if (proguardErrors?.length) {
      if (proguardErrors[0]?.type === 'proguard_potentially_misconfigured_plugin') {
        trackAnalytics('issue_error_banner.proguard_misconfigured.displayed', {
          organization,
          group: event?.groupID,
          platform: project.platform,
        });
      } else if (proguardErrors[0]?.type === 'proguard_missing_mapping') {
        trackAnalytics('issue_error_banner.proguard_missing_mapping.displayed', {
          organization,
          group: event?.groupID,
          platform: project.platform,
        });
      }
    }
    // Just for analytics, only track this once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errorMessages = groupedErrors(event, data, proguardErrors);

  useRouteAnalyticsParams({
    show_actionable_items_cta: data ? data.errors.length > 0 : false,
    actionable_items: data ? Object.keys(errorMessages) : [],
  });

  if (
    isLoading ||
    !defined(data) ||
    data.errors.length === 0 ||
    Object.keys(errorMessages).length === 0
  ) {
    return null;
  }

  if (proguardErrorsLoading) {
    // XXX: This is necessary for acceptance tests to wait until removal since there is
    // no visual loading state.
    return <HiddenDiv data-test-id="event-errors-loading" />;
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

  const hasErrorAlert = Object.keys(errorMessages).some(
    error =>
      !ActionableItemWarning.includes(
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
      {hasErrorAlert
        ? t('Sentry has identified the following problems for you to fix')
        : t('Sentry has identified the following problems for you to monitor')}
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

const HiddenDiv = styled('div')`
  display: none;
`;
