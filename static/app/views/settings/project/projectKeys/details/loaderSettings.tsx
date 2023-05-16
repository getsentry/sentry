import {Fragment, useCallback, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import ExternalLink from 'sentry/components/links/externalLink';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = {
  data: ProjectKey;
  keyId: string;
  orgSlug: string;
  project: Project;
  updateData: (data: ProjectKey) => void;
};

export function LoaderSettings({keyId, orgSlug, project, data, updateData}: Props) {
  const api = useApi();

  const [requestPending, setRequestPending] = useState(false);

  const [optimisticState, setOptimisticState] = useState({
    browserSdkVersion: data.browserSdkVersion,
    hasDebug: data.dynamicSdkLoaderOptions.hasDebug,
    hasPerformance: data.dynamicSdkLoaderOptions.hasPerformance,
    hasReplay: data.dynamicSdkLoaderOptions.hasReplay,
  });

  const values = requestPending
    ? optimisticState
    : {
        browserSdkVersion: data.browserSdkVersion,
        hasDebug: data.dynamicSdkLoaderOptions.hasDebug,
        hasPerformance: data.dynamicSdkLoaderOptions.hasPerformance,
        hasReplay: data.dynamicSdkLoaderOptions.hasReplay,
      };

  const apiEndpoint = `/projects/${orgSlug}/${project.slug}/keys/${keyId}/`;
  const loaderLink = getDynamicText({
    value: data.dsn.cdn,
    fixed: '__JS_SDK_LOADER_URL__',
  });

  const updateLoaderOption = useCallback(
    async (changes: {
      browserSdkVersion?: string;
      hasDebug?: boolean;
      hasPerformance?: boolean;
      hasReplay?: boolean;
    }) => {
      setRequestPending(true);
      setOptimisticState({
        browserSdkVersion: data.browserSdkVersion,
        hasDebug: data.dynamicSdkLoaderOptions.hasDebug,
        hasPerformance: data.dynamicSdkLoaderOptions.hasPerformance,
        hasReplay: data.dynamicSdkLoaderOptions.hasReplay,
        ...changes,
      });
      addLoadingMessage();

      const browserSdkVersion = changes.browserSdkVersion ?? data.browserSdkVersion;

      let payload: any;
      if (sdkVersionSupportsPerformanceAndReplay(browserSdkVersion)) {
        payload = {
          browserSdkVersion,
          dynamicSdkLoaderOptions: {
            hasDebug: changes.hasDebug ?? data.dynamicSdkLoaderOptions.hasDebug,
            hasPerformance:
              changes.hasPerformance ?? data.dynamicSdkLoaderOptions.hasPerformance,
            hasReplay: changes.hasReplay ?? data.dynamicSdkLoaderOptions.hasReplay,
          },
        };
      } else {
        payload = {
          browserSdkVersion,
          dynamicSdkLoaderOptions: {
            hasDebug: changes.hasDebug ?? data.dynamicSdkLoaderOptions.hasDebug,
            hasPerformance: false,
            hasReplay: false,
          },
        };
      }

      try {
        const response = await api.requestPromise(apiEndpoint, {
          method: 'PUT',
          data: payload,
        });

        updateData(response);

        addSuccessMessage(t('Successfully updated dynamic SDK loader configuration'));
      } catch (error) {
        const message = t('Unable to updated dynamic SDK loader configuration');
        handleXhrErrorResponse(message, error);
        addErrorMessage(message);
      } finally {
        setRequestPending(false);
      }
    },
    [
      api,
      apiEndpoint,
      data.browserSdkVersion,
      data.dynamicSdkLoaderOptions.hasDebug,
      data.dynamicSdkLoaderOptions.hasPerformance,
      data.dynamicSdkLoaderOptions.hasReplay,
      setRequestPending,
      updateData,
    ]
  );

  return (
    <Access access={['project:write']} project={project}>
      {({hasAccess}) => (
        <Fragment>
          <FieldGroup
            help={tct(
              'Copy this script into your website to setup your JavaScript SDK without any additional configuration. [link]',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/lazy-load-sentry/">
                    {t(' What does the script provide?')}
                  </ExternalLink>
                ),
              }
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput>
              {`<script src='${loaderLink}' crossorigin="anonymous"></script>`}
            </TextCopyInput>
          </FieldGroup>

          <SelectField
            name="browserSdkVersion"
            label={t('SDK Version')}
            options={
              data.browserSdk
                ? data.browserSdk.choices.map(([value, label]) => ({
                    value,
                    label,
                  }))
                : []
            }
            value={values.browserSdkVersion}
            onChange={value => {
              updateLoaderOption({browserSdkVersion: value});
            }}
            placeholder="7.x"
            allowClear={false}
            disabled={!hasAccess || requestPending}
          />

          <BooleanField
            label={t('Enable Performance Monitoring')}
            name="has-performance"
            value={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? values.hasPerformance
                : false
            }
            onChange={value => {
              updateLoaderOption({hasPerformance: value});
            }}
            disabled={
              !hasAccess ||
              requestPending ||
              !sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
            }
            help={
              !sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? t('Only available in SDK version 7.x and above')
                : undefined
            }
            disabledReason={
              !hasAccess
                ? t('You do not have permission to edit this setting')
                : undefined
            }
          />

          <BooleanField
            label={t('Enable Session Replay')}
            name="has-replay"
            value={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? values.hasReplay
                : false
            }
            onChange={value => {
              updateLoaderOption({hasReplay: value});
            }}
            disabled={
              !hasAccess ||
              requestPending ||
              !sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
            }
            help={
              !sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? t('Only available in SDK version 7.x and above')
                : data.dynamicSdkLoaderOptions.hasReplay
                ? t(
                    'When using Replay, the loader will load the ES6 bundle instead of the ES5 bundle.'
                  )
                : undefined
            }
            disabledReason={
              !hasAccess
                ? t('You do not have permission to edit this setting')
                : undefined
            }
          />

          <BooleanField
            label={t('Enable Debug Bundles & Logging')}
            name="has-logging"
            value={values.hasDebug}
            onChange={value => {
              updateLoaderOption({hasDebug: value});
            }}
            disabled={!hasAccess || requestPending}
            disabledReason={
              !hasAccess
                ? t('You do not have permission to edit this setting')
                : undefined
            }
          />
        </Fragment>
      )}
    </Access>
  );
}

function sdkVersionSupportsPerformanceAndReplay(sdkVersion: string): boolean {
  return sdkVersion === 'latest' || sdkVersion === '7.x';
}
