import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getStoreCrashReportsCallout} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getCurlSnippet = (params: Params) => `
curl -X POST \
'${params.dsn.public}' \
-F upload_file_minidump=@mini.dmp`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      title: t('Creating and Uploading Minidumps'),
      description: (
        <Fragment>
          <p>
            {t(
              'Depending on your operating system and programming language, there are various alternatives to create minidumps and upload them to Sentry. See the following resources for libraries that support generating minidump crash reports:'
            )}
          </p>
          <List symbol="bullet">
            <ListItem>
              <ExternalLink href="https://docs.sentry.io/platforms/native/">
                Native SDK
              </ExternalLink>
            </ListItem>
            <ListItem>
              <ExternalLink href="https://docs.sentry.io/platforms/native/guides/breakpad/">
                Google Breakpad
              </ExternalLink>
            </ListItem>
            <ListItem>
              <ExternalLink href="https://docs.sentry.io/platforms/native/guides/crashpad/">
                Google Crashpad
              </ExternalLink>
            </ListItem>
          </List>
        </Fragment>
      ),
      configurations: [
        {
          description: tct(
            'If you have already integrated a library that generates minidumps and would just like to upload them to Sentry, you need to configure the [italic:Minidump Endpoint URL], which can be found at [italic:Project Settings > Client Keys (DSN)]. This endpoint expects a [code:POST] request with the minidump in the [code:upload_file_minidump] field:',
            {
              code: <code />,
              italic: <i />,
            }
          ),
          language: 'bash',
          code: getCurlSnippet(params),
        },
        {
          description: tct(
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
  verify: params => [getStoreCrashReportsCallout(params)],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
};

export default docs;
