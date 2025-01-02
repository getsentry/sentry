import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {Button} from 'sentry/components/button';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export enum StepType {
  INSTALL = 'install',
  CONFIGURE = 'configure',
  VERIFY = 'verify',
}

export const StepTitle = {
  [StepType.INSTALL]: t('Install'),
  [StepType.CONFIGURE]: t('Configure SDK'),
  [StepType.VERIFY]: t('Verify'),
};

interface CodeSnippetTab {
  code: string;
  label: string;
  language: string;
  value: string;
  filename?: string;
}

interface TabbedCodeSnippetProps {
  /**
   * An array of tabs to be displayed
   */
  tabs: CodeSnippetTab[];
  /**
   * A callback to be invoked when the configuration is copied to the clipboard
   */
  onCopy?: () => void;
  /**
   * A callback to be invoked when the configuration is selected and copied to the clipboard
   */
  onSelectAndCopy?: () => void;
  /**
   * Whether or not the configuration or parts of it are currently being loaded
   */
  partialLoading?: boolean;
}

export function TabbedCodeSnippet({
  tabs,
  onCopy,
  onSelectAndCopy,
  partialLoading,
}: TabbedCodeSnippetProps) {
  const [selectedTabValue, setSelectedTabValue] = useState(tabs[0]!.value);
  const selectedTab = tabs.find(tab => tab.value === selectedTabValue) ?? tabs[0]!;
  const {code, language, filename} = selectedTab;

  return (
    <OnboardingCodeSnippet
      dark
      language={language}
      onCopy={onCopy}
      onSelectAndCopy={onSelectAndCopy}
      hideCopyButton={partialLoading}
      disableUserSelection={partialLoading}
      tabs={tabs}
      selectedTab={selectedTabValue}
      onTabClick={value => setSelectedTabValue(value)}
      filename={filename}
    >
      {language === 'javascript'
        ? beautify.js(code, {
            indent_size: 2,
            e4x: true,
            brace_style: 'preserve-inline',
          })
        : code.trim()}
    </OnboardingCodeSnippet>
  );
}

export type Configuration = {
  /**
   * Additional information to be displayed below the code snippet
   */
  additionalInfo?: React.ReactNode;
  /**
   * The code snippet to display
   */
  code?: string | CodeSnippetTab[];
  /**
   * Nested configurations provide a convenient way to accommodate diverse layout styles, like the Spring Boot configuration.
   */
  configurations?: Configuration[];
  /**
   * A brief description of the configuration
   */
  description?: React.ReactNode;
  /**
   * The language of the code to be rendered (python, javascript, etc)
   */
  language?: string;
  /**
   * A callback to be invoked when the configuration is copied to the clipboard
   */
  onCopy?: () => void;
  /**
   * A callback to be invoked when the configuration is selected and copied to the clipboard
   */
  onSelectAndCopy?: () => void;
  /**
   * Whether or not the configuration or parts of it are currently being loaded
   */
  partialLoading?: boolean;
};

// TODO(aknaus): move to types
interface BaseStepProps {
  /**
   * Additional information to be displayed below the configurations
   */
  additionalInfo?: React.ReactNode;
  /**
   * Content that goes directly above the code snippet
   */
  codeHeader?: React.ReactNode;
  /**
   * Whether the step instructions are collapsible
   */
  collapsible?: boolean;
  /**
   * An array of configurations to be displayed
   */
  configurations?: Configuration[];
  /**
   * A brief description of the step
   */
  description?: React.ReactNode | React.ReactNode[];
  /**
   * Fired when the optional toggle is clicked.
   * Useful for when we want to fire analytics events.
   */
  onOptionalToggleClick?: (showOptionalConfig: boolean) => void;
}
interface StepPropsWithTitle extends BaseStepProps {
  title: string;
  type?: undefined;
}

interface StepPropsWithoutTitle extends BaseStepProps {
  type: StepType;
  title?: undefined;
}

export type StepProps = StepPropsWithTitle | StepPropsWithoutTitle;

function getConfiguration({
  description,
  code,
  language,
  additionalInfo,
  onCopy,
  onSelectAndCopy,
  partialLoading,
}: Configuration) {
  return (
    <Configuration>
      {description && <Description>{description}</Description>}
      {Array.isArray(code) ? (
        <TabbedCodeSnippet
          tabs={code}
          onCopy={onCopy}
          onSelectAndCopy={onSelectAndCopy}
          partialLoading={partialLoading}
        />
      ) : (
        language &&
        code && (
          <OnboardingCodeSnippet
            dark
            language={language}
            onCopy={onCopy}
            onSelectAndCopy={onSelectAndCopy}
            hideCopyButton={partialLoading}
            disableUserSelection={partialLoading}
          >
            {language === 'javascript'
              ? beautify.js(code, {
                  indent_size: 2,
                  e4x: true,
                  brace_style: 'preserve-inline',
                })
              : code.trim()}
          </OnboardingCodeSnippet>
        )
      )}
      {additionalInfo && <AdditionalInfo>{additionalInfo}</AdditionalInfo>}
    </Configuration>
  );
}

export function Step({
  title,
  type,
  configurations,
  additionalInfo,
  description,
  onOptionalToggleClick,
  collapsible = false,
  codeHeader,
}: StepProps) {
  const [showOptionalConfig, setShowOptionalConfig] = useState(false);

  const config = (
    <Fragment>
      {description && <Description>{description}</Description>}

      {!!configurations?.length && (
        <Configurations>
          {configurations.map((configuration, index) => {
            if (configuration.configurations) {
              return (
                <Fragment key={index}>
                  {getConfiguration(configuration)}
                  {configuration.configurations.map(
                    (nestedConfiguration, nestedConfigurationIndex) => (
                      <Fragment key={nestedConfigurationIndex}>
                        {nestedConfigurationIndex ===
                        (configuration.configurations?.length ?? 1) - 1
                          ? codeHeader
                          : null}
                        {getConfiguration(nestedConfiguration)}
                      </Fragment>
                    )
                  )}
                </Fragment>
              );
            }
            return (
              <Fragment key={index}>
                {index === configurations.length - 1 ? codeHeader : null}
                {getConfiguration(configuration)}
              </Fragment>
            );
          })}
        </Configurations>
      )}
      {additionalInfo && <GeneralAdditionalInfo>{additionalInfo}</GeneralAdditionalInfo>}
    </Fragment>
  );

  return collapsible ? (
    <div>
      <OptionalConfigWrapper
        expanded={showOptionalConfig}
        onClick={() => {
          onOptionalToggleClick?.(!showOptionalConfig);
          setShowOptionalConfig(!showOptionalConfig);
        }}
      >
        <h4 style={{marginBottom: 0}}>{title ?? StepTitle[type]}</h4>
        <ToggleButton
          priority="link"
          borderless
          size="zero"
          icon={<IconChevron direction={showOptionalConfig ? 'down' : 'right'} />}
          aria-label={t('Toggle optional configuration')}
        />
      </OptionalConfigWrapper>
      {showOptionalConfig ? config : null}
    </div>
  ) : (
    <div>
      <h4>{title ?? StepTitle[type]}</h4>
      {config}
    </div>
  );
}

const Configuration = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Configurations = styled(Configuration)`
  margin-top: ${space(2)};
`;

const Description = styled('div')`
  code {
    color: ${p => p.theme.pink400};
  }

  && > p,
  && > h4,
  && > h5,
  && > h6 {
    margin-bottom: ${space(1)};
  }
`;

const AdditionalInfo = styled(Description)``;

const GeneralAdditionalInfo = styled(Description)`
  margin-top: ${space(2)};
`;

const OptionalConfigWrapper = styled('div')<{expanded: boolean}>`
  display: flex;
  gap: ${space(1)};
  margin-bottom: ${p => (p.expanded ? space(2) : 0)};
  cursor: pointer;
`;

const ToggleButton = styled(Button)`
  padding: 0;
  &,
  :hover {
    color: ${p => p.theme.gray500};
  }
`;
