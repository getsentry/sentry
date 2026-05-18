import type React from 'react';

import type {EventErrorData} from 'sentry/components/events/interfaces/types';
import {
  GenericSchemaErrors,
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t} from 'sentry/locale';

import type {ActionableItemErrors} from './actionableItemsUtils';

export interface ErrorMessage {
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

export function getErrorMessage(
  error: ActionableItemErrors | EventErrorData,
  meta?: Record<string, any>
): ErrorMessage[] {
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
    case NativeProcessingErrors.NATIVE_SYMBOLICATOR_FAILED:
      return [
        {
          title: t('Failed to process native stacktraces'),
          desc: null,
          data: errorData,
          meta: metaData,
        },
      ];
    case NativeProcessingErrors.NATIVE_INTERNAL_FAILURE:
      return [
        {
          title: t('Internal failure when attempting to symbolicate'),
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
