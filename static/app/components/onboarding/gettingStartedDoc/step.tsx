import type React from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {Flex} from '@sentry/scraps/layout/flex';

import {Button, ButtonBar} from 'sentry/components/core/button';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {
  OnboardingCodeSnippet,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {
  StepType,
  type Configuration,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const StepTitles: Record<StepType, string> = {
  [StepType.INSTALL]: t('Install'),
  [StepType.CONFIGURE]: t('Configure SDK'),
  [StepType.VERIFY]: t('Verify'),
};

function getConfiguration({
  description,
  code,
  language,
  additionalInfo,
  onCopy,
  onSelectAndCopy,
}: Configuration) {
  return (
    <Configuration>
      {description && <Description>{description}</Description>}
      {Array.isArray(code) ? (
        <TabbedCodeSnippet
          tabs={code}
          onCopy={onCopy}
          onSelectAndCopy={onSelectAndCopy}
        />
      ) : (
        language &&
        code && (
          <OnboardingCodeSnippet
            language={language}
            onCopy={onCopy}
            onSelectAndCopy={onSelectAndCopy}
          >
            {code}
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
  content,
  additionalInfo,
  description,
  onOptionalToggleClick,
  collapsible = false,
  trailingItems,
  codeHeader,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> & OnboardingStep) {
  const [showOptionalConfig, setShowOptionalConfig] = useState(false);

  const config = content ? (
    <ContentWrapper>
      <ContentBlocksRenderer contentBlocks={content} />
    </ContentWrapper>
  ) : (
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

  const stepTitle = <StepTitle>{title ?? StepTitles[type]}</StepTitle>;
  const trailingItemsContent = trailingItems ? (
    <ButtonBar onClick={e => e.stopPropagation()}>{trailingItems}</ButtonBar>
  ) : null;

  return collapsible ? (
    <div {...props}>
      <OptionalConfigWrapper
        expanded={showOptionalConfig}
        onClick={() => {
          onOptionalToggleClick?.(!showOptionalConfig);
          setShowOptionalConfig(!showOptionalConfig);
        }}
      >
        {stepTitle}
        <ToggleButton
          priority="link"
          borderless
          size="zero"
          icon={<IconChevron direction={showOptionalConfig ? 'down' : 'right'} />}
          aria-label={t('Toggle optional configuration')}
        />
        {trailingItemsContent}
      </OptionalConfigWrapper>
      {showOptionalConfig ? config : null}
    </div>
  ) : (
    <div {...props}>
      {trailingItems ? (
        <Flex justify="between" align="center" gap="sm">
          {stepTitle}
          {trailingItemsContent}
        </Flex>
      ) : (
        stepTitle
      )}
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
  code:not([class*='language-']) {
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
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: ${p => (p.expanded ? space(2) : 0)};
  cursor: pointer;
`;

const ToggleButton = styled(Button)`
  flex: 1;
  display: flex;
  justify-content: flex-start;
  padding: 0;
  &,
  :hover {
    color: ${p => p.theme.gray500};
  }
`;
