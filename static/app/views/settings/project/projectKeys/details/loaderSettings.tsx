import {Fragment, useCallback, useEffect, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import ExternalLink from 'sentry/components/links/externalLink';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDynamicText from 'sentry/utils/getDynamicText';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = {
  keyId: string;
  organizationId: string;
  projectId: string;
  projectKey: ProjectKey;
};

export enum DynamicSDKLoaderOption {
  HAS_DEBUG = 'hasDebug',
  HAS_PERFORMANCE = 'hasPerformance',
  HAS_REPLAY = 'hasReplay',
}

export const sdkLoaderOptions = {
  [DynamicSDKLoaderOption.HAS_PERFORMANCE]: {
    label: t('Enable Performance Monitoring'),
    requiresV7: true,
  },
  [DynamicSDKLoaderOption.HAS_REPLAY]: {
    label: t('Enable Session Replay'),
    requiresV7: true,
  },
  [DynamicSDKLoaderOption.HAS_DEBUG]: {
    label: t('Enable Debug Bundles & Logging'),
    requiresV7: false,
  },
};

export function LoaderSettings({keyId, organizationId, projectId, projectKey}: Props) {
  const api = useApi();
  const [browserSdkVersion, setBrowserSdkVersion] = useState(
    projectKey.browserSdkVersion
  );
  const [dynamicSDKLoaderOptions, setDynamicSDKLoaderOptions] = useState(
    projectKey.dynamicSdkLoaderOptions
  );

  useEffect(() => {
    setBrowserSdkVersion(projectKey.browserSdkVersion);
  }, [projectKey.browserSdkVersion]);

  useEffect(() => {
    setDynamicSDKLoaderOptions(projectKey.dynamicSdkLoaderOptions);
  }, [projectKey.dynamicSdkLoaderOptions]);

  const apiEndpoint = `/projects/${organizationId}/${projectId}/keys/${keyId}/`;
  const loaderLink = getDynamicText({
    value: projectKey.dsn.cdn,
    fixed: '__JS_SDK_LOADER_URL__',
  });

  const handleToggleDynamicSDKLoaderOption = useCallback(
    async <T extends typeof dynamicSDKLoaderOptions, K extends keyof T>(
      dynamicSdkLoaderOption: K,
      value: T[K]
    ) => {
      const newDynamicSdkLoaderOptions = Object.keys(dynamicSDKLoaderOptions).reduce(
        (acc, key) => {
          if (key === dynamicSdkLoaderOption) {
            return {...acc, [key]: value};
          }
          return {...acc, [key]: dynamicSDKLoaderOptions[key]};
        },
        {}
      );

      addLoadingMessage();

      try {
        const response = await api.requestPromise(apiEndpoint, {
          method: 'PUT',
          data: {
            dynamicSdkLoaderOptions: newDynamicSdkLoaderOptions,
          },
        });

        setDynamicSDKLoaderOptions(response.dynamicSdkLoaderOptions);

        addSuccessMessage(t('Successfully updated dynamic SDK loader configuration'));
      } catch (error) {
        const message = t('Unable to updated dynamic SDK loader configuration');
        handleXhrErrorResponse(message)(error);
        addErrorMessage(message);
      }
    },
    [api, apiEndpoint, dynamicSDKLoaderOptions, setDynamicSDKLoaderOptions]
  );

  const handleUpdateBrowserSDKVersion = useCallback(
    async (newBrowserSDKVersion: typeof browserSdkVersion) => {
      addLoadingMessage();

      const apiData: {
        browserSdkVersion: typeof browserSdkVersion;
        dynamicSdkLoaderOptions?: Partial<Record<DynamicSDKLoaderOption, boolean>>;
      } = {
        browserSdkVersion: newBrowserSDKVersion,
      };

      const shouldRestrictDynamicSdkLoaderOptions =
        !sdkVersionSupportsPerformanceAndReplay(newBrowserSDKVersion);

      if (shouldRestrictDynamicSdkLoaderOptions) {
        // Performance & Replay are not supported before 7.x
        const newDynamicSdkLoaderOptions = {
          ...dynamicSDKLoaderOptions,
          hasPerformance: false,
          hasReplay: false,
        };

        apiData.dynamicSdkLoaderOptions = newDynamicSdkLoaderOptions;
      }

      try {
        const response = await api.requestPromise(apiEndpoint, {
          method: 'PUT',
          data: apiData,
        });

        setBrowserSdkVersion(response.browserSdkVersion);

        if (shouldRestrictDynamicSdkLoaderOptions) {
          setDynamicSDKLoaderOptions(response.dynamicSdkLoaderOptions);
        }

        addSuccessMessage(t('Successfully updated SDK version'));
      } catch (error) {
        const message = t('Unable to updated SDK version');
        handleXhrErrorResponse(message)(error);
        addErrorMessage(message);
      }
    },
    [
      api,
      apiEndpoint,
      setBrowserSdkVersion,
      setDynamicSDKLoaderOptions,
      dynamicSDKLoaderOptions,
    ]
  );

  return (
    <Access access={['project:write']}>
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

            <FieldHelp style={{paddingTop: space(1)}}>
              {t('Note that it can take a few minutes until changed options are live.')}
            </FieldHelp>
          </FieldGroup>

          <SelectField
            name="browserSdkVersion"
            label={t('SDK Version')}
            options={
              projectKey.browserSdk
                ? projectKey.browserSdk.choices.map(([value, label]) => ({
                    value,
                    label,
                  }))
                : []
            }
            value={browserSdkVersion}
            onChange={handleUpdateBrowserSDKVersion}
            placeholder={t('4.x')}
            allowClear={false}
            disabled={!hasAccess}
          />

          {Object.entries(sdkLoaderOptions).map(([key, value]) => {
            const sdkLoaderOption = Object.keys(dynamicSDKLoaderOptions).find(
              dynamicSdkLoaderOption => dynamicSdkLoaderOption === key
            );

            if (!sdkLoaderOption) {
              return null;
            }

            return (
              <BooleanField
                label={value.label}
                key={key}
                name={key}
                value={
                  value.requiresV7 &&
                  !sdkVersionSupportsPerformanceAndReplay(browserSdkVersion)
                    ? false
                    : dynamicSDKLoaderOptions[sdkLoaderOption]
                }
                onChange={() =>
                  handleToggleDynamicSDKLoaderOption(
                    sdkLoaderOption as DynamicSDKLoaderOption,
                    !dynamicSDKLoaderOptions[sdkLoaderOption]
                  )
                }
                disabled={
                  !hasAccess ||
                  (value.requiresV7 &&
                    !sdkVersionSupportsPerformanceAndReplay(browserSdkVersion))
                }
                help={
                  value.requiresV7 &&
                  !sdkVersionSupportsPerformanceAndReplay(browserSdkVersion)
                    ? t('Only available in SDK version 7.x and above')
                    : key === DynamicSDKLoaderOption.HAS_REPLAY &&
                      dynamicSDKLoaderOptions[sdkLoaderOption]
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
            );
          })}
        </Fragment>
      )}
    </Access>
  );
}

function sdkVersionSupportsPerformanceAndReplay(sdkVersion: string): boolean {
  return sdkVersion === 'latest' || sdkVersion === '7.x';
}
