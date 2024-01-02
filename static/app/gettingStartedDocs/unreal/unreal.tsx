import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <Fragment>
        <p>
          {tct(
            "Download the latest plugin sources from the [link:Releases] page and place it in the project's 'Plugins' directory. On the next project launch, UE will prompt to build Sentry module.",
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-unreal/releases" />
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
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          "Access the Sentry configuration window by going to editor's menu: [strong:Project Settings > Plugins > Sentry] and enter the following DSN:",
          {strong: <strong />}
        )}
      </p>
    ),
    configurations: [
      {
        language: 'url',
        code: dsn,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'Once everything is configured you can call the plugin API from both C++ and blueprints:'
    ),
    configurations: [
      {
        language: 'cpp',
        code: `
#include "SentrySubsystem.h"

void Verify()
{
    // Obtain reference to GameInstance
    UGameInstance* GameInstance = ...;

    // Capture message
    USentrySubsystem* SentrySubsystem = GameInstance->GetSubsystem<USentrySubsystem>();
    SentrySubsystem->CaptureMessage(TEXT("Capture message"));
}
        `,
      },
    ],
  },
  {
    title: t('Crash Reporter Client'),
    description: (
      <p>
        {tct(
          'For Windows and Mac, [link:Crash Reporter Client] provided along with Unreal Engine has to be configured in order to capture errors automatically.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/unreal/setup-crashreporter/" />
            ),
          }
        )}
      </p>
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
            <h5>{t('Debug Information')}</h5>
            {t(
              'To get the most out of Sentry, crash reports must include debug information. In order for Sentry to be able to process the crash report and translate memory addresses to meaningful information like function names, module names, and line numbers, the crash itself must include debug information. In addition, symbols need to be uploaded to Sentry.'
            )}
            <p>
              {tct(
                "The option is also located under [strong:Project > Packaging]; select 'show advanced' followed by checking the box for 'Include Debug Files'.",
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
                "Now that the crash reporter and debug files are included, UE needs to know where to send the crash. For that, add the Sentry 'Unreal Engine Endpoint' from the 'Client Keys' settings page to the game's configuration file. This will include which project in Sentry you want to see crashes displayed in. That's accomplished by configuring the [code:CrashReportClient] in the [italic:DefaultEngine.ini] file. Changing the engine is necessary for this to work. Edit the file:",
                {
                  code: <code />,
                  italic: <i />,
                }
              )}
            </p>
            <AlertWithoutMarginBottom type="info">
              engine-dir\Engine\Programs\CrashReportClient\Config\DefaultEngine.ini
            </AlertWithoutMarginBottom>
          </Fragment>
        ),
        configurations: [
          {
            description: t('Add the configuration section:'),
            language: 'ini',
            code: `
    [CrashReportClient]
    CrashReportClientVersion=1.0
    DataRouterUrl="${dsn}"
            `,
            additionalInfo: (
              <p>
                {tct(
                  'If a [crashReportCode:CrashReportClient] section already exists, simply changing the value of [dataRouterUrlCode:DataRouterUrl] is enough.',
                  {crashReportCode: <code />, dataRouterUrlCode: <code />}
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
            'To allow Sentry to fully process native crashes and provide you with symbolicated stack traces, you need to upload [debugInformationItalic:debug information files] (sometimes also referred to as [debugSymbolsItalic:debug symbols] or just [symbolsItalic:symbols]). We recommend uploading debug information during your build or release process.',
            {
              debugInformationItalic: <i />,
              symbolsItalic: <i />,
              debugSymbolsItalic: <i />,
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
];
// Configuration End

export function GettingStartedWithUnreal({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithUnreal;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;
