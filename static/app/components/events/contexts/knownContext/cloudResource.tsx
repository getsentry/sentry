import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

// https://github.com/getsentry/relay/blob/24.10.0/relay-event-schema/src/protocol/contexts/cloud_resource.rs
const enum CloudResourceContextKeys {
  CLOUD_ACCOUNT_ID = 'cloud.account.id',
  CLOUD_PROVIDER = 'cloud.provider',
  CLOUD_PLATFORM = 'cloud.platform',
  CLOUD_REGION = 'cloud.region',
  CLOUD_AVAILABILITY_ZONE = 'cloud.availability_zone',
  HOST_ID = 'host.id',
  HOST_TYPE = 'host.type',
}

export interface CloudResourceContext {
  // Any custom keys users may set
  [key: string]: any;
  [CloudResourceContextKeys.CLOUD_ACCOUNT_ID]?: string;
  [CloudResourceContextKeys.CLOUD_PROVIDER]?: string;
  [CloudResourceContextKeys.CLOUD_PLATFORM]?: string;
  [CloudResourceContextKeys.CLOUD_REGION]?: string;
  [CloudResourceContextKeys.CLOUD_AVAILABILITY_ZONE]?: string;
  [CloudResourceContextKeys.HOST_ID]?: string;
  [CloudResourceContextKeys.HOST_TYPE]?: string;
}

const CLOUD_PROVIDERS = {
  alibaba_cloud: t('Alibaba Cloud'),
  aws: t('Amazon Web Services'),
  azure: t('Microsoft Azure'),
  gcp: t('Google Cloud Platform'),
  ibm_cloud: t('IBM Cloud'),
  tencent_cloud: t('Tencent Cloud'),
};

export function getCloudResourceContextData({
  data = {},
  meta,
}: {
  data: CloudResourceContext;
  meta?: Record<keyof CloudResourceContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case CloudResourceContextKeys.CLOUD_ACCOUNT_ID:
        return {
          key: ctxKey,
          subject: t('Account ID'),
          value: data[CloudResourceContextKeys.CLOUD_ACCOUNT_ID],
        };
      case CloudResourceContextKeys.CLOUD_PROVIDER:
        const provider = data[CloudResourceContextKeys.CLOUD_PROVIDER];
        return {
          key: ctxKey,
          subject: t('Provider'),
          value:
            provider && CLOUD_PROVIDERS[provider] ? CLOUD_PROVIDERS[provider] : provider,
        };
      case CloudResourceContextKeys.CLOUD_PLATFORM:
        return {
          key: ctxKey,
          subject: t('Platform'),
          value: data[CloudResourceContextKeys.CLOUD_PLATFORM],
        };
      case CloudResourceContextKeys.CLOUD_REGION:
        return {
          key: ctxKey,
          subject: t('Region'),
          value: data[CloudResourceContextKeys.CLOUD_REGION],
        };
      case CloudResourceContextKeys.CLOUD_AVAILABILITY_ZONE:
        return {
          key: ctxKey,
          subject: t('Availability Zone'),
          value: data[CloudResourceContextKeys.CLOUD_AVAILABILITY_ZONE],
        };
      case CloudResourceContextKeys.HOST_ID:
        return {
          key: ctxKey,
          subject: t('Host ID'),
          value: data[CloudResourceContextKeys.HOST_ID],
        };

      case CloudResourceContextKeys.HOST_TYPE:
        return {
          key: ctxKey,
          subject: t('Host Type'),
          value: data[CloudResourceContextKeys.HOST_TYPE],
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
