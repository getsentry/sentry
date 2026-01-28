import {Fragment, useCallback, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {ExternalLink} from 'sentry/components/core/link';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {Project, ProjectKey} from 'sentry/types/project';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

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
    hasFeedback: data.dynamicSdkLoaderOptions.hasFeedback,
    hasPerformance: data.dynamicSdkLoaderOptions.hasPerformance,
    hasReplay: data.dynamicSdkLoaderOptions.hasReplay,
  });

  const values = requestPending
    ? optimisticState
    : {
        browserSdkVersion:
          // "latest" was an option that we don't let users select anymore. It will be phased out when version v8 of
          // the SDK is released, meaning we want to map the backend's response to v7 when it responds with "latest".
          // "7.x" was the "latest" version when "latest" was phased out.
          data.browserSdkVersion === 'latest' ? '7.x' : data.browserSdkVersion,
        hasDebug: data.dynamicSdkLoaderOptions.hasDebug,
        hasFeedback: data.dynamicSdkLoaderOptions.hasFeedback,
        hasPerformance: data.dynamicSdkLoaderOptions.hasPerformance,
        hasReplay: data.dynamicSdkLoaderOptions.hasReplay,
      };

  const sdkVersionChoices = data.browserSdk
    ? // "latest" was an option that we do not want to allow users to select anymore. It was phased out with v7, before v8 was released.
      data.browserSdk.choices.filter(([value]) => value !== 'latest')
    : [];

  const apiEndpoint = `/projects/${orgSlug}/${project.slug}/keys/${keyId}/`;
  const loaderLink = data.dsn.cdn;

  const updateLoaderOption = useCallback(
    async (changes: {
      browserSdkVersion?: string;
      hasDebug?: boolean;
      hasFeedback?: boolean;
      hasPerformance?: boolean;
      hasReplay?: boolean;
    }) => {
      setRequestPending(true);
      setOptimisticState({
        browserSdkVersion: data.browserSdkVersion,
        hasDebug: data.dynamicSdkLoaderOptions.hasDebug,
        hasFeedback: data.dynamicSdkLoaderOptions.hasFeedback,
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
            hasFeedback: changes.hasFeedback ?? data.dynamicSdkLoaderOptions.hasFeedback,
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
            hasFeedback: false,
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
        handleXhrErrorResponse(message, error as RequestError);
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
      data.dynamicSdkLoaderOptions.hasFeedback,
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
            <TextCopyInput aria-label={t('Loader Script')}>
              {`<script src="${loaderLink}" crossorigin="anonymous"></script>`}
            </TextCopyInput>
          </FieldGroup>

          <SelectField
            name={`${keyId}-browserSdkVersion`}
            label={t('SDK Version')}
            options={sdkVersionChoices.map(([value, label]) => ({
              value,
              label,
            }))}
            value={values.browserSdkVersion}
            onChange={(value: any) => {
              updateLoaderOption({browserSdkVersion: value});
            }}
            disabledReason={
              sdkVersionChoices.length === 1
                ? t(
                    'At the moment, only the shown SDK version is available. New versions of the SDK will appear here as soon as they are released, and you will be able to upgrade by selecting them.'
                  )
                : undefined
            }
            placeholder="7.x"
            allowClear={false}
            disabled={!hasAccess || requestPending || sdkVersionChoices.length === 1}
          />

          <BooleanField
            label={t('Enable Performance Monitoring')}
            name={`${keyId}-has-performance`}
            value={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? values.hasPerformance
                : false
            }
            onChange={(value: any) => {
              updateLoaderOption({hasPerformance: value});
            }}
            disabled={
              !hasAccess ||
              requestPending ||
              !sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
            }
            help={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? data.dynamicSdkLoaderOptions.hasPerformance
                  ? tct(
                      'The default config is [codeTracesSampleRate:tracesSampleRate: 1.0] and distributed tracing to same-origin requests. [configDocs:Read the docs] to learn how to configure this.',
                      {
                        codeTracesSampleRate: <code />,
                        configDocs: (
                          <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/loader/#custom-configuration" />
                        ),
                      }
                    )
                  : undefined
                : t('Only available in SDK version 7.x and above')
            }
            disabledReason={
              hasAccess ? undefined : t('You do not have permission to edit this setting')
            }
          />

          <BooleanField
            label={t('Enable Session Replay')}
            name={`${keyId}-has-replay`}
            value={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? values.hasReplay
                : false
            }
            onChange={(value: any) => {
              updateLoaderOption({hasReplay: value});
            }}
            disabled={
              !hasAccess ||
              requestPending ||
              !sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
            }
            help={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? data.dynamicSdkLoaderOptions.hasReplay
                  ? tct(
                      `[es5Warning]The default config is [codeReplay:replaysSessionSampleRate: 0.1] and [codeError:replaysOnErrorSampleRate: 1]. [configDocs:Read the docs] to learn how to configure this.`,
                      {
                        es5Warning:
                          // latest is deprecated but resolves to v7
                          data.browserSdkVersion === '7.x' ||
                          data.browserSdkVersion === 'latest'
                            ? t(
                                'When using Replay, the loader will load the ES6 bundle instead of the ES5 bundle.'
                              ) + ' '
                            : '',
                        codeReplay: <code />,
                        codeError: <code />,
                        configDocs: (
                          <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/loader/#custom-configuration" />
                        ),
                      }
                    )
                  : undefined
                : t('Only available in SDK version 7.x and above')
            }
            disabledReason={
              hasAccess ? undefined : t('You do not have permission to edit this setting')
            }
          />

          <BooleanField
            label={t('Enable User Feedback')}
            name={`${keyId}-has-feedback`}
            value={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? values.hasFeedback
                : false
            }
            onChange={(value: any) => {
              updateLoaderOption({hasFeedback: value});
            }}
            disabled={
              !hasAccess ||
              requestPending ||
              !sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
            }
            help={
              sdkVersionSupportsPerformanceAndReplay(data.browserSdkVersion)
                ? data.dynamicSdkLoaderOptions.hasFeedback
                  ? tct(
                      `[es6Warning]The default config is [codeAutoInject:autoInject: true]. [configDocs:Read the docs] to learn how to configure this.`,
                      {
                        es6Warning:
                          // latest is deprecated but resolves to v7
                          data.browserSdkVersion === '7.x' ||
                          data.browserSdkVersion === 'latest'
                            ? t(
                                'When using User Feedback, the loader will load the ES6 bundle instead of the ES5 bundle.'
                              ) + ' '
                            : '',
                        codeAutoInject: <code />,
                        configDocs: (
                          <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/loader/#custom-configuration" />
                        ),
                      }
                    )
                  : undefined
                : t('Only available in SDK version 7.x and above')
            }
            disabledReason={
              hasAccess ? undefined : t('You do not have permission to edit this setting')
            }
          />

          <BooleanField
            label={t('Enable SDK debugging')}
            name={`${keyId}-has-debug`}
            value={values.hasDebug}
            onChange={(value: any) => {
              updateLoaderOption({hasDebug: value});
            }}
            disabled={!hasAccess || requestPending}
            disabledReason={
              hasAccess ? undefined : t('You do not have permission to edit this setting')
            }
          />
        </Fragment>
      )}
    </Access>
  );
}

function sdkVersionSupportsPerformanceAndReplay(sdkVersion: string): boolean {
  return (
    sdkVersion === 'latest' ||
    sdkVersion === '7.x' ||
    sdkVersion === '8.x' ||
    sdkVersion === '9.x' ||
    sdkVersion === '10.x'
  );
}
