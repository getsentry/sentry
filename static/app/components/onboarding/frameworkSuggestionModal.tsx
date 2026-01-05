import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';
import {PlatformIcon} from 'platformicons';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import CollapsePanel, {COLLAPSE_COUNT} from 'sentry/components/collapsePanel';
import {Button} from 'sentry/components/core/button';
import {Radio} from 'sentry/components/core/radio';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {ProjectCreationErrorAlert} from 'sentry/components/onboarding/projectCreationErrorAlert';
import {
  useCreateProjectAndRulesError,
  useIsCreatingProjectAndRules,
} from 'sentry/components/onboarding/useCreateProjectAndRules';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {categoryList, createablePlatforms} from 'sentry/data/platformPickerCategories';
import platforms from 'sentry/data/platforms';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export enum SupportedLanguages {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  NODE = 'node',
  DOTNET = 'dotnet',
  JAVA = 'java',
  GO = 'go',
}

const topGoFrameworks: PlatformKey[] = [
  'go-echo',
  'go-fasthttp',
  'go-fiber',
  'go-gin',
  'go-http',
  'go-iris',
  'go-negroni',
];

export const topJavascriptFrameworks: PlatformKey[] = [
  'javascript-nextjs',
  'javascript-react',
  'javascript-react-router',
  'javascript-vue',
  'javascript-nuxt',
  'javascript-angular',
  'javascript-solid',
  'javascript-solidstart',
  'javascript-remix',
  'javascript-svelte',
  'javascript-sveltekit',
  'javascript-astro',
];

const topPythonFrameworks: PlatformKey[] = [
  'python-django',
  'python-flask',
  'python-fastapi',
  'python-awslambda',
  'python-aiohttp',
];

const topNodeFrameworks: PlatformKey[] = [
  'node-express',
  'node-nestjs',
  'node-awslambda',
  'node-gcpfunctions',
  'node-koa',
];

const topDotNetFrameworks: PlatformKey[] = [
  'dotnet-aspnetcore',
  'dotnet-aspnet',
  'dotnet-maui',
  'dotnet-wpf',
  'dotnet-winforms',
  'dotnet-xamarin',
  'dotnet-gcpfunctions',
  'dotnet-awslambda',
];

const topJavaFrameworks: PlatformKey[] = [
  'java-spring-boot',
  'java-spring',
  'java-logback',
  'java-log4j2',
];

export const languageDescriptions: Partial<Record<PlatformKey, string>> = {
  [SupportedLanguages.JAVASCRIPT]: t(
    'Our JavaScript framework SDKs include all the features of our Browser Javascript SDK with additional features specific to that framework'
  ),
  [SupportedLanguages.NODE]: t(
    'Our Node framework SDKs include all the features of our Node SDK with instructions specific to that framework'
  ),
  [SupportedLanguages.PYTHON]: t(
    'Our Python framework SDKs include all the features of our Python SDK with instructions specific to that framework'
  ),
  [SupportedLanguages.DOTNET]: t(
    'Our .NET integrations include all the features of our core .NET SDK with instructions specific to that framework'
  ),
  [SupportedLanguages.JAVA]: t(
    'Our Java framework SDKs include all the features of our Java SDK with instructions specific to that framework'
  ),
  [SupportedLanguages.GO]: t(
    'Our Go framework SDKs include all the features of our Go SDK with instructions specific to that framework'
  ),
};

interface FrameworkSuggestionModalProps extends ModalRenderProps {
  onConfigure: (selectedFramework: OnboardingSelectedSDK) => void;
  onSkip: () => void;
  organization: Organization;
  selectedPlatform: OnboardingSelectedSDK;
  newOrg?: boolean;
}

export function FrameworkSuggestionModal({
  Body,
  Footer,
  selectedPlatform,
  onSkip,
  onConfigure,
  closeModal,
  CloseButton,
  organization,
  newOrg,
}: FrameworkSuggestionModalProps) {
  const isCreatingProjectAndRules = useIsCreatingProjectAndRules();
  const createProjectAndRulesError = useCreateProjectAndRulesError();

  const [selectedFramework, setSelectedFramework] = useState<
    OnboardingSelectedSDK | undefined
  >(selectedPlatform);

  const frameworks = platforms.filter(
    platform =>
      createablePlatforms.has(platform.id) &&
      platform.type === 'framework' &&
      platform.language === selectedPlatform.key
  );

  const [topFrameworks, otherFrameworks] = partition(frameworks, framework => {
    if (selectedPlatform.key === SupportedLanguages.NODE) {
      return topNodeFrameworks.includes(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.PYTHON) {
      return topPythonFrameworks.includes(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.DOTNET) {
      return topDotNetFrameworks.includes(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.JAVA) {
      return topJavaFrameworks.includes(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.GO) {
      return topGoFrameworks.includes(framework.id);
    }
    return topJavascriptFrameworks.includes(framework.id);
  });

  const otherFrameworksSortedAlphabetically = sortBy(otherFrameworks);
  const topFrameworksOrdered = sortBy(topFrameworks, framework => {
    if (selectedPlatform.key === SupportedLanguages.NODE) {
      return topNodeFrameworks.indexOf(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.PYTHON) {
      return topPythonFrameworks.indexOf(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.DOTNET) {
      return topDotNetFrameworks.indexOf(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.JAVA) {
      return topJavaFrameworks.indexOf(framework.id);
    }
    if (selectedPlatform.key === SupportedLanguages.GO) {
      return topGoFrameworks.indexOf(framework.id);
    }
    return topJavascriptFrameworks.indexOf(framework.id);
  });

  useEffect(() => {
    trackAnalytics(
      newOrg
        ? 'onboarding.select_framework_modal_rendered'
        : 'project_creation.select_framework_modal_rendered',
      {
        platform: selectedPlatform.key,
        organization,
      }
    );
  }, [selectedPlatform.key, organization, newOrg]);

  const handleConfigure = useCallback(() => {
    if (!selectedFramework) {
      return;
    }

    trackAnalytics(
      newOrg
        ? 'onboarding.select_framework_modal_configure_sdk_button_clicked'
        : 'project_creation.select_framework_modal_configure_sdk_button_clicked',
      {
        platform: selectedPlatform.key,
        framework: selectedFramework.key,
        organization,
      }
    );

    onConfigure(selectedFramework);
  }, [selectedPlatform, selectedFramework, organization, onConfigure, newOrg]);

  const handleSkip = useCallback(() => {
    trackAnalytics(
      newOrg
        ? 'onboarding.select_framework_modal_skip_button_clicked'
        : 'project_creation.select_framework_modal_skip_button_clicked',
      {
        platform: selectedPlatform.key,
        organization,
      }
    );
    onSkip();
  }, [selectedPlatform, organization, onSkip, newOrg]);

  const handleClick = useCallback(() => {
    if (selectedFramework?.key === selectedPlatform.key) {
      handleSkip();
    } else {
      handleConfigure();
    }
  }, [handleSkip, handleConfigure, selectedFramework, selectedPlatform]);

  const debounceHandleClick = useMemo(
    () => debounce(handleClick, 2000, {leading: true, trailing: false}),
    [handleClick]
  );

  const listEntries: PlatformIntegration[] = [
    ...topFrameworksOrdered,
    ...otherFrameworksSortedAlphabetically,
  ];

  const listEntriesWithVanilla: PlatformIntegration[] = [
    {
      id: selectedPlatform.key,
      type: selectedPlatform.type,
      name: t('Nope, Vanilla'),
      language: selectedPlatform.key,
      link: selectedPlatform.link,
    },
    ...listEntries,
  ];

  useEffect(() => {
    const documentElement = document.querySelector('[role="dialog"] [role="document"]');
    if (
      !(documentElement instanceof HTMLElement) ||
      listEntriesWithVanilla.length <= COLLAPSE_COUNT
    ) {
      return;
    }
    documentElement.style.minHeight = '631px';
  }, [listEntriesWithVanilla.length]);

  return (
    <Fragment>
      <Header>
        <CloseButton onClick={closeModal} />
      </Header>
      <Body>
        <TopFrameworksImage frameworks={listEntries} />
        <Heading>{t('Do you use a framework?')}</Heading>
        <Description>{languageDescriptions[selectedPlatform.key]}</Description>
        <ProjectCreationErrorAlert error={createProjectAndRulesError} />
        <StyledPanel>
          <StyledPanelBody>
            <CollapsePanel
              items={listEntriesWithVanilla.length}
              collapseCount={COLLAPSE_COUNT}
              buttonTitle={tn(
                'Hidden Framework',
                'Hidden Frameworks',
                listEntriesWithVanilla.length - COLLAPSE_COUNT
              )}
            >
              {({isExpanded, showMoreButton}) => {
                const items = isExpanded
                  ? listEntriesWithVanilla
                  : listEntriesWithVanilla.slice(0, COLLAPSE_COUNT);
                return (
                  <Fragment>
                    <PlatformList>
                      {items.map((platform, index) => {
                        const platformCategory =
                          categoryList.find(category => {
                            return category.platforms?.has(platform.id);
                          })?.id ?? 'all';

                        return (
                          <PlatformListItem key={platform.id}>
                            <RadioLabel
                              index={index}
                              onClick={() =>
                                setSelectedFramework({
                                  key: platform.id,
                                  type: platform.type,
                                  language: platform.language,
                                  category: platformCategory,
                                  link: platform.link,
                                  name: platform.name,
                                })
                              }
                            >
                              <RadioBox
                                size="sm"
                                checked={selectedFramework?.key === platform.id}
                                readOnly
                              />
                              <PlatformListItemIcon size={24} platform={platform.id} />
                              {platform.name}
                            </RadioLabel>
                          </PlatformListItem>
                        );
                      })}
                    </PlatformList>
                    {showMoreButton && (
                      <ShowMoreButtonWrapper>{showMoreButton}</ShowMoreButtonWrapper>
                    )}
                  </Fragment>
                );
              }}
            </CollapsePanel>
          </StyledPanelBody>
        </StyledPanel>
      </Body>
      <Footer>
        <Button
          priority="primary"
          onClick={debounceHandleClick}
          busy={isCreatingProjectAndRules}
        >
          {t('Configure SDK')}
        </Button>
      </Footer>
    </Fragment>
  );
}

function TopFrameworksImage({frameworks}: {frameworks: PlatformIntegration[]}) {
  const top3 = frameworks.slice(0, 3);
  if (top3.length < 3) {
    return null;
  }

  return (
    <TopFrameworksImageWrapper>
      <TopFrameworkIcon
        size={84}
        platform={top3[1]!.id}
        angle={-34}
        radius={8}
        offset={-74}
        format="lg"
      />
      <TopFrameworkIcon
        size={84}
        platform={top3[2]!.id}
        angle={34}
        radius={8}
        offset={+74}
        format="lg"
      />
      <TopFrameworkIcon
        size={84}
        platform={top3[0]!.id}
        angle={0}
        radius={8}
        offset={0}
        format="lg"
      />
    </TopFrameworksImageWrapper>
  );
}

const Header = styled('header')`
  position: relative;
  height: 30px;

  margin: -${space(4)} -${space(2)} 0 -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin: -${space(4)} -${space(4)} 0 -${space(4)};
  }
`;

const TopFrameworkIcon = styled(PlatformIcon, {
  shouldForwardProp: prop => prop !== 'angle' && prop !== 'offset',
})<{angle: number; offset: number}>`
  transform: translate(calc(-50% + ${p => p.offset}px), -50%) rotate(${p => p.angle}deg);
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid ${p => p.theme.border};
`;

const TopFrameworksImageWrapper = styled('div')`
  position: relative;
  width: 256px;
  height: 108px;
  min-height: 108px;
  margin: 0px auto ${space(2)};
`;

const Heading = styled('h6')`
  margin-bottom: ${space(1)};
  text-align: center;
`;

const Description = styled(TextBlock)`
  margin-bottom: ${space(2)};
  text-align: center;
`;

const PlatformList = styled(List)`
  margin: 0 !important;
  gap: 0;
  display: block; /* Needed to prevent list item from stretching if the list is scrollable (Safari) */
  overflow-y: auto;
  max-height: 631px;
`;

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const StyledPanelBody = styled(PanelBody)`
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const ShowMoreButtonWrapper = styled('div')`
  min-height: 40px;
  display: flex;
  align-items: center;
  width: 100%;
  > :first-child {
    flex: 1;
  }
`;

const PlatformListItem = styled(ListItem)`
  min-height: 40px;
  display: grid;
  text-align: left;
  cursor: pointer;
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const PlatformListItemIcon = styled(PlatformIcon)`
  border: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const RadioLabel = styled(RadioLineItem)`
  display: inline-grid;
  grid-template-columns: max-content max-content 1fr;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  gap: ${space(1.5)};
  input {
    cursor: pointer;
  }
`;

const RadioBox = styled(Radio)`
  padding: ${space(0.5)};
`;

// Style the modals document and section elements as flex containers
// to allow the list of frameworks to dynamically grow and shrink with the dialog / screen height
export const modalCss = css`
  [role='document'] {
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    min-height: 550px;
  }
  section {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  max-width: 400px;
  width: 100%;
`;
