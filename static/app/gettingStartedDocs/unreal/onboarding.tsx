import {ExternalLink} from 'sentry/components/core/link';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getConsoleExtensions} from 'sentry/components/onboarding/gettingStartedDoc/utils/consoleExtensions';
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

const getSettingsConfigureSnippet = (params: Params) => `
#include "SentrySubsystem.h"

FConfigureSettingsDelegate OnConfigureSettings;
OnConfigureSettings.BindDynamic(this, &UMyGameInstance::ConfigureSentrySettings);

void UMyGameInstance::ConfigureSentrySettings(USentrySettings* Settings)
{
    Settings->Dsn = TEXT("${params.dsn.public}");

    // Add data like user ip address and device name
    // See https://docs.sentry.io/platforms/unreal/data-management/data-collected/ for more info
    Settings->SendDefaultPii = true;

    // If your game/app doesn't have sensitive data, you can get screenshots on error events automatically
    Settings->AttachScreenshot = true;
}

...

USentrySubsystem* SentrySubsystem = GEngine->GetEngineSubsystem<USentrySubsystem>();
SentrySubsystem->InitializeWithSettings(OnConfigureSettings);`;

const getCrashReporterConfigSnippet = (params: Params) => `
[CrashReportClient]
CrashReportClientVersion=1.0
DataRouterUrl="${params.dsn.unreal}"`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "We recommend downloading the latest plugin sources from the [releasesPage: GitHub Releases page], but we also support [installMethods: alternate installation methods]. To integrate Sentry into your Unreal Engine project using the GitHub package, select the artifact that matches your Unreal Engine version and includes `github` in its name. Place the extracted files in your project's 'Plugins' directory. On the next project launch, UE will prompt to build Sentry module.",
            {
              releasesPage: (
                <ExternalLink href="https://github.com/getsentry/sentry-unreal/releases" />
              ),
              installMethods: (
                <ExternalLink href="https://docs.sentry.io/platforms/unreal/#install" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: t(
            'After the successful build, in the editor navigate to the [strong:Project Settings > Plugins > Code Plugins] menu and check whether the Sentry plugin is enabled.',
            {
              strong: <strong />,
            }
          ),
        },
        {
          type: 'text',
          text: t(
            'To access the plugin API from within C++, add Sentry support to the build script (MyProject.build.cs):'
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: 'PublicDependencyModuleNames.AddRange(new string[] { ..., "Sentry" });',
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            "Access the Sentry configuration window by going to editor's menu: [strong:Project Settings > Plugins > Sentry] and enter the following DSN:",
            {strong: <strong />}
          ),
        },
        {
          type: 'code',
          language: 'url',
          code: params.dsn.public,
        },
        {
          type: 'text',
          text: tct(
            "By default, the SDK initializes automatically when the application starts. Alternatively, you can disable the [strong:Initialize SDK automatically] option, in which case you'll need to initialize the SDK manually",
            {strong: <strong />}
          ),
        },
        {
          type: 'code',
          language: 'cpp',
          code: getSettingsConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Once everything is configured you can call the plugin API from both C++ and blueprints:'
          ),
        },
        {
          type: 'code',
          language: 'cpp',
          code: getVerifySnippet(),
        },
      ],
    },
    {
      title: t('Crash Reporter Client'),
      content: [
        {
          type: 'text',
          text: tct(
            'In Unreal Engine versions prior to UE 5.2 to automatically capture errors on desktop platforms [link:Crash Reporter Client] has to be configured.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unreal/setup-crashreporter/" />
              ),
            }
          ),
        },
        {
          type: 'subheader',
          text: t('Include the UE Crash Reporter'),
        },
        {
          type: 'text',
          text: tct(
            'You can add the crash reporter client to your game in [strong:Project Settings].',
            {strong: <strong />}
          ),
        },
        {
          type: 'text',
          text: tct(
            'The option is located under [strong:Project > Packaging]; select "show advanced" followed by checking the box for "Include Crash Reporter".',
            {strong: <strong />}
          ),
        },
        {
          type: 'subheader',
          text: t('Configure the Crash Reporter Endpoint'),
        },
        {
          type: 'text',
          text: tct(
            "Now that the crash reporter is included, UE needs to know where to send the crash. For that, add the Sentry 'Unreal Engine Endpoint' from the 'Client Keys' settings page to the game's configuration file. This will include which project in Sentry you want to see crashes displayed in. That's accomplished by configuring the [code:CrashReportClient] in the [italic:DefaultEngine.ini] file. Changing the engine is necessary for this to work. Edit the file:",
            {
              code: <code />,
              italic: <i />,
            }
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          showIcon: false,
          text: 'engine-dir\\Engine\\Programs\\CrashReportClient\\Config\\DefaultEngine.ini',
        },
        {
          type: 'text',
          text: t('Add the configuration section:'),
        },
        {
          type: 'code',
          language: 'ini',
          code: getCrashReporterConfigSnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'If a [code:CrashReportClient] section already exists, simply changing the value of [code:DataRouterUrl] is enough.',
            {code: <code />}
          ),
        },
      ],
    },
    {
      title: t('Upload Debug Symbols'),
      content: [
        {
          type: 'text',
          text: tct(
            'To allow Sentry to fully process native crashes and provide you with symbolicated stack traces, you need to upload [link:debug information files] (sometimes also referred to as [italic:debug symbols] or just [italic:symbols]). We recommend uploading debug information during your build or release process.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unreal/configuration/debug-symbols/" />
              ),
              italic: <i />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            "For all libraries where you'd like to receive symbolication, [strong:you need to provide debug information]. This includes dependencies and operating system libraries.",
            {
              strong: <strong />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'In addition to debug information files, Sentry needs [italic:call frame information] (CFI) to extract accurate stack traces from minidumps of optimized release builds. CFI is usually part of the executables and not copied to debug symbols. Unless you are uploading Breakpad symbols, be sure to also include the binaries when uploading files to Sentry',
            {italic: <i />}
          ),
        },
        {
          type: 'subheader',
          text: t('Automated Upload'),
        },
        {
          type: 'text',
          text: tct(
            "The automated debug symbols upload is disabled by default and requires configuration. To enable it, go to [strong:Project Settings > Plugins > Code Plugins] in your editor and turn on 'Upload debug symbols automatically'.",
            {strong: <strong />}
          ),
        },
        {
          type: 'text',
          text: t(
            'Alternatively, you can enable automatic upload by setting the following environment variable:'
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: `export SENTRY_UPLOAD_SYMBOLS_AUTOMATICALLY=True`,
        },
        {
          type: 'text',
          text: t(
            'This can be especially helpful in CI/CD environments where manual configuration is impractical.'
          ),
        },
        {
          type: 'subheader',
          text: t('Manual Upload'),
        },
        {
          type: 'text',
          text: tct(
            "To manually upload debug symbols, you'll need to use [code:sentry-cli]. This requires your [strong:organization slug], [strong:project slug], and an [strong:authentication token]. These can be configured in one of two ways:",
            {code: <code />, strong: <strong />}
          ),
        },
        {
          type: 'list',
          items: [
            t('Environment variables (recommended)'),
            tct(
              'A [code:sentry.properties] file (automatically created by the Unreal Engine SDK)',
              {code: <code />}
            ),
          ],
        },
        {
          type: 'text',
          text: tct(
            'If the properties file is not found, [code:sentry-cli] will fall back to these environment variables if they are set:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: `export SENTRY_ORG=${params.organization.slug}
export SENTRY_PROJECT=${params.project.slug}
export SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___`,
        },
        {
          type: 'text',
          text: t('To upload debug symbols, run the following command:'),
        },
        {
          type: 'code',
          language: 'bash',
          code: `sentry-cli --auth-token ___ORG_AUTH_TOKEN___ debug-files upload --org ${params.organization.slug} --project ${params.project.slug} PATH_TO_SYMBOLS`,
        },
        {
          type: 'text',
          text: tct(
            'For more information on uploading debug information and their supported formats, check out our [link:Debug Symbols Uploading documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unreal/configuration/debug-symbols/" />
              ),
            }
          ),
        },
      ],
    },
    ...([getConsoleExtensions(params)].filter(Boolean) as OnboardingStep[]),
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
