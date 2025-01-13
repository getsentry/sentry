import type React from 'react';
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

export const StepTitles = {
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
  ...props
}: React.HTMLAttributes<HTMLDivElement> & StepProps) {
  const [showOptionalConfig, setShowOptionalConfig] = useState(false);

  const config = (
    <ContentWrapper>
      {description && <Description>{description}</Description>}

      {!!configurations?.length &&
        configurations.map((configuration, index) => {
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
      {additionalInfo && <GeneralAdditionalInfo>{additionalInfo}</GeneralAdditionalInfo>}
    </ContentWrapper>
  );

  return collapsible ? (
    <div {...props}>
      <OptionalConfigWrapper
        expanded={showOptionalConfig}
        onClick={() => {
          onOptionalToggleClick?.(!showOptionalConfig);
          setShowOptionalConfig(!showOptionalConfig);
        }}
      >
        <StepTitle>{title ?? StepTitles[type]}</StepTitle>
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
    <div {...props}>
      <StepTitle>{title ?? StepTitles[type]}</StepTitle>
      {config}
    </div>
  );
}

// NOTE: We intentionally avoid using flex or grid here
// as it leads to weird text selection behavior in Safari
// see https://github.com/getsentry/sentry/issues/79958

const CONTENT_SPACING = space(2);

const ContentWrapper = styled('div')`
  margin-top: ${CONTENT_SPACING};
`;

const StepTitle = styled('h4')`
  margin-bottom: 0 !important;
`;

const Configuration = styled('div')`
  :not(:last-child) {
    margin-bottom: ${CONTENT_SPACING};
  }
`;

const Description = styled('div')`
  code {
    color: ${p => p.theme.pink400};
  }

  :not(:last-child) {
    margin-bottom: ${CONTENT_SPACING};
  }

  && > p,
  && > h4,
  && > h5,
  && > h6 {
    &:not(:last-child) {
      margin-bottom: ${CONTENT_SPACING};
    }
  }
`;

const AdditionalInfo = styled(Description)`
  margin-top: ${CONTENT_SPACING};
`;

const GeneralAdditionalInfo = styled(Description)`
  margin-top: ${CONTENT_SPACING};
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
