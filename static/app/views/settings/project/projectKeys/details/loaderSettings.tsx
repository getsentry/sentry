import {Fragment} from 'react';
import {z} from 'zod';

import {AutoSaveForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Access} from 'sentry/components/acl/access';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {Project, ProjectKey} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';

const loaderSchema = z.object({
  browserSdkVersion: z.string(),
  hasDebug: z.boolean(),
  hasFeedback: z.boolean(),
  hasLogsAndMetrics: z.boolean(),
  hasPerformance: z.boolean(),
  hasReplay: z.boolean(),
});

type Props = {
  data: ProjectKey;
  keyId: string;
  orgSlug: string;
  project: Project;
  updateData: (data: ProjectKey) => void;
};

export function LoaderSettings({keyId, orgSlug, project, data, updateData}: Props) {
  const endpoint = `/projects/${orgSlug}/${project.slug}/keys/${keyId}/`;

  const sdkVersionChoices = data.browserSdk
    ? data.browserSdk.choices.filter(([value]) => value !== 'latest')
    : [];

  const loaderLink = data.dsn.cdn;

  // Changing the SDK version can make some options unsupported, so we send the
  // full set of loader options (forcing the unsupported ones to false) alongside
  // the new version. Individual option toggles only send their own field and
  // rely on the backend merging them into the stored options.
  function buildVersionPayload(browserSdkVersion: string) {
    if (sdkVersionSupportsPerformanceAndReplay(browserSdkVersion)) {
      return {
        browserSdkVersion,
        dynamicSdkLoaderOptions: {
          hasDebug: data.dynamicSdkLoaderOptions.hasDebug,
          hasLogsAndMetrics: sdkVersionSupportsLogsAndMetrics(browserSdkVersion)
            ? data.dynamicSdkLoaderOptions.hasLogsAndMetrics
            : false,
          hasFeedback: data.dynamicSdkLoaderOptions.hasFeedback,
          hasPerformance: data.dynamicSdkLoaderOptions.hasPerformance,
          hasReplay: data.dynamicSdkLoaderOptions.hasReplay,
        },
      };
    }

    return {
      browserSdkVersion,
      dynamicSdkLoaderOptions: {
        hasDebug: data.dynamicSdkLoaderOptions.hasDebug,
        hasLogsAndMetrics: false,
        hasFeedback: false,
        hasPerformance: false,
        hasReplay: false,
      },
    };
  }

  const supportsPerformance = sdkVersionSupportsPerformanceAndReplay(
    data.browserSdkVersion
  );
  const supportsLogs = sdkVersionSupportsLogsAndMetrics(data.browserSdkVersion);

  return (
    <Access access={['project:write']} project={project}>
      {({hasAccess}) => (
        <Fragment>
          <Stack gap="lg">
            <Text variant="muted" size="sm">
              {tct(
                'Copy this script into your website to setup your JavaScript SDK without any additional configuration. [link]',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/lazy-load-sentry/">
                      {t(' What does the script provide?')}
                    </ExternalLink>
                  ),
                }
              )}
            </Text>
            <TextCopyInput aria-label={t('Loader Script')}>
              {`<script src="${loaderLink}" crossorigin="anonymous"></script>`}
            </TextCopyInput>
          </Stack>

          <AutoSaveForm
            name="browserSdkVersion"
            schema={loaderSchema}
            initialValue={
              data.browserSdkVersion === 'latest' ? '7.x' : data.browserSdkVersion
            }
            mutationOptions={{
              mutationFn: (submitData: {browserSdkVersion: string}) =>
                fetchMutation<ProjectKey>({
                  url: endpoint,
                  method: 'PUT',
                  data: buildVersionPayload(submitData.browserSdkVersion),
                }),
              onSuccess: updateData,
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('SDK Version')}
                hintText={
                  sdkVersionChoices.length === 1
                    ? t(
                        'At the moment, only the shown SDK version is available. New versions of the SDK will appear here as soon as they are released, and you will be able to upgrade by selecting them.'
                      )
                    : undefined
                }
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={sdkVersionChoices.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  disabled={!hasAccess || sdkVersionChoices.length === 1}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="hasPerformance"
            schema={loaderSchema}
            initialValue={
              supportsPerformance ? data.dynamicSdkLoaderOptions.hasPerformance : false
            }
            mutationOptions={{
              mutationFn: (submitData: {hasPerformance: boolean}) =>
                fetchMutation<ProjectKey>({
                  url: endpoint,
                  method: 'PUT',
                  data: {dynamicSdkLoaderOptions: submitData},
                }),
              onSuccess: updateData,
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable Performance Monitoring')}
                hintText={
                  supportsPerformance
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
              >
                <field.Switch
                  checked={supportsPerformance ? field.state.value : false}
                  onChange={field.handleChange}
                  disabled={
                    hasAccess
                      ? supportsPerformance
                        ? undefined
                        : t('Only available in SDK version 7.x and above')
                      : t('You do not have permission to edit this setting')
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="hasReplay"
            schema={loaderSchema}
            initialValue={
              supportsPerformance ? data.dynamicSdkLoaderOptions.hasReplay : false
            }
            mutationOptions={{
              mutationFn: (submitData: {hasReplay: boolean}) =>
                fetchMutation<ProjectKey>({
                  url: endpoint,
                  method: 'PUT',
                  data: {dynamicSdkLoaderOptions: submitData},
                }),
              onSuccess: updateData,
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable Session Replay')}
                hintText={
                  supportsPerformance
                    ? data.dynamicSdkLoaderOptions.hasReplay
                      ? tct(
                          '[es5Warning]The default config is [codeReplay:replaysSessionSampleRate: 0.1] and [codeError:replaysOnErrorSampleRate: 1]. [configDocs:Read the docs] to learn how to configure this.',
                          {
                            es5Warning:
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
              >
                <field.Switch
                  checked={supportsPerformance ? field.state.value : false}
                  onChange={field.handleChange}
                  disabled={
                    hasAccess
                      ? supportsPerformance
                        ? undefined
                        : t('Only available in SDK version 7.x and above')
                      : t('You do not have permission to edit this setting')
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="hasLogsAndMetrics"
            schema={loaderSchema}
            initialValue={
              supportsLogs ? data.dynamicSdkLoaderOptions.hasLogsAndMetrics : false
            }
            mutationOptions={{
              mutationFn: (submitData: {hasLogsAndMetrics: boolean}) =>
                fetchMutation<ProjectKey>({
                  url: endpoint,
                  method: 'PUT',
                  data: {dynamicSdkLoaderOptions: submitData},
                }),
              onSuccess: updateData,
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable Logs and Metrics')}
                hintText={
                  supportsLogs
                    ? data.dynamicSdkLoaderOptions.hasLogsAndMetrics
                      ? tct(
                          'The default config is [codeEnableLogs:enableLogs: true]. [configDocs:Read the docs] to learn how to configure this.',
                          {
                            codeEnableLogs: <code />,
                            configDocs: (
                              <ExternalLink href="https://docs.sentry.io/platforms/javascript/logs" />
                            ),
                          }
                        )
                      : undefined
                    : t('Only available in SDK version 10.x and above')
                }
              >
                <field.Switch
                  checked={supportsLogs ? field.state.value : false}
                  onChange={field.handleChange}
                  disabled={
                    hasAccess
                      ? supportsLogs
                        ? undefined
                        : t('Only available in SDK version 10.x and above')
                      : t('You do not have permission to edit this setting')
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="hasFeedback"
            schema={loaderSchema}
            initialValue={
              supportsPerformance ? data.dynamicSdkLoaderOptions.hasFeedback : false
            }
            mutationOptions={{
              mutationFn: (submitData: {hasFeedback: boolean}) =>
                fetchMutation<ProjectKey>({
                  url: endpoint,
                  method: 'PUT',
                  data: {dynamicSdkLoaderOptions: submitData},
                }),
              onSuccess: updateData,
            }}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable User Feedback')}
                hintText={
                  supportsPerformance
                    ? data.dynamicSdkLoaderOptions.hasFeedback
                      ? tct(
                          '[es6Warning]The default config is [codeAutoInject:autoInject: true]. [configDocs:Read the docs] to learn how to configure this.',
                          {
                            es6Warning:
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
              >
                <field.Switch
                  checked={supportsPerformance ? field.state.value : false}
                  onChange={field.handleChange}
                  disabled={
                    hasAccess
                      ? supportsPerformance
                        ? undefined
                        : t('Only available in SDK version 7.x and above')
                      : t('You do not have permission to edit this setting')
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>

          <AutoSaveForm
            name="hasDebug"
            schema={loaderSchema}
            initialValue={data.dynamicSdkLoaderOptions.hasDebug}
            mutationOptions={{
              mutationFn: (submitData: {hasDebug: boolean}) =>
                fetchMutation<ProjectKey>({
                  url: endpoint,
                  method: 'PUT',
                  data: {dynamicSdkLoaderOptions: submitData},
                }),
              onSuccess: updateData,
            }}
          >
            {field => (
              <field.Layout.Row label={t('Enable SDK debugging')}>
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={
                    hasAccess
                      ? undefined
                      : t('You do not have permission to edit this setting')
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
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

function sdkVersionSupportsLogsAndMetrics(sdkVersion: string): boolean {
  return sdkVersion === '10.x';
}
