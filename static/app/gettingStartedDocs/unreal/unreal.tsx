import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getVerifySnippet = () => `
#include "SentrySubsystem.h"

void Verify()
{
    // Obtain reference to GameInstance
    UGameInstance* GameInstance = ...;

    // Capture message
    USentrySubsystem* SentrySubsystem = GameInstance->GetSubsystem<USentrySubsystem>();
    SentrySubsystem->CaptureMessage(TEXT("Capture message"));
}`;

const getCrashReporterConfigSnippet = (params: Params) => `
[CrashReportClient]
CrashReportClientVersion=1.0
DataRouterUrl="${params.dsn.unreal}"`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: (
        <Fragment>
          <p>
            {tct(
              "We recommend downloading the latest plugin sources from the [releasesPage: GitHub Releases page], but we also support [installMethods: alternate installation methods]. To integrate Sentry into your Unreal Engine project using the GitHub package, select the artifact that matches your Unreal Engine version and includes `github` in its name. Place the extracted files in your project's 'Plugins' directory. On the next project launch, UE will prompt to build Sentry module.",
              {
                releasesPage: (
                  <ExternalLink href="https://github.com/getsentry/sentry-unreal/releases" />
                ),
                installMethods: (
                  <ExternalLink href="https://docs.sentry.io/platforms/unreal/#install" />
                ),
              }
            )}
          </p>
          <p>
            {tct(
              'After the successful build, in the editor navigate to the [strong:Project Settings > Plugins > Code Plugins] menu and check whether the Sentry plugin is enabled.',
              {
                strong: <strong />,
              }
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'csharp',
          description: t(
            "To access the plugin API from within C++, add Sentry support to the build script (MyProject.build.cs):'"
          ),
          code: 'PublicDependencyModuleNames.AddRange(new string[] { ..., "Sentry" });',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        "Access the Sentry configuration window by going to editor's menu: [strong:Project Settings > Plugins > Sentry] and enter the following DSN:",
        {strong: <strong />}
      ),
      configurations: [
        {
          language: 'url',
          code: params.dsn.public,
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      description: t(
        'Once everything is configured you can call the plugin API from both C++ and blueprints:'
      ),
      configurations: [
        {
          language: 'cpp',
          code: getVerifySnippet(),
        },
      ],
    },
    {
      title: t('Crash Reporter Client'),
      description: tct(
        'In Unreal Engine versions prior to UE 5.2 to automatically capture errors on desktop platforms [link:Crash Reporter Client] has to be configured.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/unreal/setup-crashreporter/" />
          ),
        }
      ),
      configurations: [
        {
          description: (
            <Fragment>
              <h5>{t('Include the UE Crash Reporter')}</h5>
              <p>
                {tct(
                  'You can add the crash reporter client to your game in [strong:Project Settings].',
                  {strong: <strong />}
                )}
              </p>
              <p>
                {tct(
                  'The option is located under [strong:Project > Packaging]; select "show advanced" followed by checking the box for "Include Crash Reporter".',
                  {strong: <strong />}
                )}
              </p>
            </Fragment>
          ),
        },
        {
          description: (
            <Fragment>
              <h5>{t('Configure the Crash Reporter Endpoint')}</h5>
              <p>
                {tct(
                  "Now that the crash reporter is included, UE needs to know where to send the crash. For that, add the Sentry 'Unreal Engine Endpoint' from the 'Client Keys' settings page to the game's configuration file. This will include which project in Sentry you want to see crashes displayed in. That's accomplished by configuring the [code:CrashReportClient] in the [italic:DefaultEngine.ini] file. Changing the engine is necessary for this to work. Edit the file:",
                  {
                    code: <code />,
                    italic: <i />,
                  }
                )}
              </p>
              <Alert type="info">
                engine-dir\Engine\Programs\CrashReportClient\Config\DefaultEngine.ini
              </Alert>
            </Fragment>
          ),
          configurations: [
            {
              description: t('Add the configuration section:'),
              language: 'ini',
              code: getCrashReporterConfigSnippet(params),
              additionalInfo: (
                <p>
                  {tct(
                    'If a [code:CrashReportClient] section already exists, simply changing the value of [code:DataRouterUrl] is enough.',
                    {code: <code />}
                  )}
                </p>
              ),
            },
          ],
        },
      ],
    },
    {
      title: t('Upload Debug Symbols'),
      description: (
        <Fragment>
          <p>
            {tct(
              'To allow Sentry to fully process native crashes and provide you with symbolicated stack traces, you need to upload [link:debug information files] (sometimes also referred to as [italic:debug symbols] or just [italic:symbols]). We recommend uploading debug information during your build or release process.',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/unreal/configuration/debug-symbols/" />
                ),
              }
            )}
          </p>
          <p>
            {tct(
              "For all libraries where you'd like to receive symbolication, [strong:you need to provide debug information]. This includes dependencies and operating system libraries.",
              {
                strong: <strong />,
              }
            )}
          </p>
          <p>
            {tct(
              'In addition to debug information files, Sentry needs [italic:call frame information] (CFI) to extract accurate stack traces from minidumps of optimized release builds. CFI is usually part of the executables and not copied to debug symbols. Unless you are uploading Breakpad symbols, be sure to also include the binaries when uploading files to Sentry',
              {italic: <i />}
            )}
          </p>
          <p>
            {tct(
              'For more information on uploading debug information and their supported formats, check out our [link:Debug Information Files documentation].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/native/data-management/debug-files/" />
                ),
              }
            )}
          </p>
        </Fragment>
      ),
    },
    {
      title: t('Further Settings'),
      description: (
        <StoreCrashReportsConfig
          organization={params.organization}
          projectSlug={params.projectSlug}
        />
      ),
    },
  ],
};

const feedbackOnboardingCrashApi: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'C++',
              value: 'cpp',
              language: 'cpp',
              code: `USentrySubsystem* SentrySubsystem = GEngine->GetEngineSubsystem<USentrySubsystem>();

USentryId* EventId = SentrySubsystem->CaptureMessage(TEXT("Message with feedback"));

USentryUserFeedback* UserFeedback = NewObject<USentryUserFeedback>();
User->Initialize(EventId);
User->SetEmail("test@sentry.io");
User->SetName("Name");
User->SetComment("Some comment");

SentrySubsystem->CaptureUserFeedback(UserFeedback);

// OR

SentrySubsystem->CaptureUserFeedbackWithParams(EventId, "test@sentry.io", "Some comment", "Name");`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi,
  crashReportOnboarding: feedbackOnboardingCrashApi,
};

export default docs;
