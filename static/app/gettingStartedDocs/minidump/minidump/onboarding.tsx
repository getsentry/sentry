import {ExternalLink} from 'sentry/components/core/link';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getCurlSnippet = (params: DocsParams) => `
curl -X POST \
'${params.dsn.minidump}' \
-F upload_file_minidump=@mini.dmp`;

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      title: t('Creating and Uploading Minidumps'),
      content: [
        {
          type: 'text',
          text: t(
            'Depending on your operating system and programming language, there are various alternatives to create minidumps and upload them to Sentry. See the following resources for libraries that support generating minidump crash reports:'
          ),
        },
        {
          type: 'list',
          items: [
            tct('[link:Native SDK]', {
              link: <ExternalLink href="https://docs.sentry.io/platforms/native/" />,
            }),
            tct('[link:Google Breakpad]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/native/guides/breakpad/" />
              ),
            }),
            tct('[link:Google Crashpad]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/native/guides/crashpad/" />
              ),
            }),
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you have already integrated a library that generates minidumps and would just like to upload them to Sentry, you need to configure the [italic:Minidump Endpoint URL], which can be found at [italic:Project Settings > Client Keys (DSN)]. This endpoint expects a [code:POST] request with the minidump in the [code:upload_file_minidump] field:',
            {
              code: <code />,
              italic: <i />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: getCurlSnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'To send additional information, add more form fields to this request. For a full description of fields accepted by Sentry, see [passingAdditionalDataLink:Passing Additional Data].',
            {
              passingAdditionalDataLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/native/guides/minidumps/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: () => [],
  verify: (params: DocsParams) => [
    {
      title: t('Further Settings'),
      content: [
        {
          type: 'custom',
          content: (
            <StoreCrashReportsConfig
              organization={params.organization}
              projectSlug={params.project.slug}
            />
          ),
        },
      ],
    },
  ],
};
