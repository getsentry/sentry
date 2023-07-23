import {Fragment, useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';
import {PlatformIcon} from 'platformicons';

import onboardingFrameworkSelectionDotnet from 'sentry-images/spot/onboarding-framework-selection-dotnet.svg';
import onboardingFrameworkSelectionJava from 'sentry-images/spot/onboarding-framework-selection-java.svg';
import onboardingFrameworkSelectionJavascript from 'sentry-images/spot/onboarding-framework-selection-javascript.svg';
import onboardingFrameworkSelectionNode from 'sentry-images/spot/onboarding-framework-selection-node.svg';
import onboardingFrameworkSelectionPython from 'sentry-images/spot/onboarding-framework-selection-python.svg';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Radio from 'sentry/components/radio';
import categoryList from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingSelectedSDK, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export enum SupportedLanguages {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  NODE = 'node',
  DOTNET = 'dotnet',
  JAVA = 'java',
}

export const topJavascriptFrameworks = [
  'javascript-react',
  'javascript-nextjs',
  'javascript-vue',
  'javascript-angular',
  'javascript-svelte',
  'javascript-sveltekit',
  'javascript-remix',
];

const topPythonFrameworks = [
  'python-django',
  'python-flask',
  'python-fastapi',
  'python-awslambda',
  'python-aiohttp',
];

const topNodeFrameworks = [
  'node-express',
  'node-awslambda',
  'node-gcpfunctions',
  'node-serverlesscloud',
  'node-koa',
];

const topDotNetFrameworks = [
  'dotnet-aspnetcore',
  'dotnet-aspnet',
  'dotnet-maui',
  'dotnet-wpf',
  'dotnet-winforms',
  'dotnet-xamarin',
  'dotnet-uwp',
  'dotnet-gcpfunctions',
  'dotnet-awslambda',
];

const topJavaFrameworks = [
  'java-spring-boot',
  'java-spring',
  'java-logback',
  'java-log4j2',
];

export const languageDetails = {
  [SupportedLanguages.JAVASCRIPT]: {
    description: t(
      'Our JavaScript framework SDKs include all the features of our Browser Javascript SDK with additional features specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionJavascript,
  },
  [SupportedLanguages.NODE]: {
    description: t(
      'Our Node framework SDKs include all the features of our Node SDK with instructions specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionNode,
  },
  [SupportedLanguages.PYTHON]: {
    description: t(
      'Our Python framework SDKs include all the features of our Python SDK with instructions specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionPython,
  },
  [SupportedLanguages.DOTNET]: {
    description: t(
      'Our Dotnet framework SDKs include all the features of our Dotnet SDK with instructions specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionDotnet,
  },
  [SupportedLanguages.JAVA]: {
    description: t(
      'Our Java framework SDKs include all the features of our Java SDK with instructions specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionJava,
  },
};

type Props = ModalRenderProps & {
  onConfigure: (selectedFramework: OnboardingSelectedSDK) => void;
  onSkip: () => void;
  organization: Organization;
  selectedPlatform: OnboardingSelectedSDK;
  newOrg?: boolean;
};

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
}: Props) {
  const [selectedFramework, setSelectedFramework] = useState<
    OnboardingSelectedSDK | undefined
  >(undefined);

  const frameworks = platforms.filter(
    platform =>
      platform.type === 'framework' && platform.language === selectedPlatform.key
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
    closeModal();
  }, [
    selectedPlatform,
    selectedFramework,
    organization,
    onConfigure,
    closeModal,
    newOrg,
  ]);

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
    closeModal();
  }, [selectedPlatform, organization, closeModal, onSkip, newOrg]);

  return (
    <Fragment>
      <Header>
        <CloseButton onClick={closeModal} />
      </Header>
      <Body>
        <TopFrameworksImage
          src={languageDetails[selectedPlatform.key].topFrameworksImage}
        />
        <Heading>{t('Do you use a framework?')}</Heading>
        <Description>{languageDetails[selectedPlatform.key].description}</Description>
        <Panel>
          <PanelBody>
            <Frameworks>
              {[...topFrameworksOrdered, ...otherFrameworksSortedAlphabetically].map(
                (framework, index) => {
                  const frameworkCategory =
                    categoryList.find(category => {
                      return category.platforms.includes(framework.id as never);
                    })?.id ?? 'all';

                  return (
                    <Framework key={framework.id}>
                      <RadioLabel
                        index={index}
                        onClick={() =>
                          setSelectedFramework({
                            key: framework.id,
                            type: framework.type,
                            language: framework.language,
                            category: frameworkCategory,
                          })
                        }
                      >
                        <RadioBox
                          radioSize="small"
                          checked={selectedFramework?.key === framework.id}
                          readOnly
                        />
                        <FrameworkIcon size={24} platform={framework.id} />
                        {framework.name}
                      </RadioLabel>
                    </Framework>
                  );
                }
              )}
            </Frameworks>
          </PanelBody>
        </Panel>
      </Body>
      <Footer>
        <Actions>
          <Button size="md" onClick={handleSkip}>
            {t('Skip')}
          </Button>
          <Button
            size="md"
            priority="primary"
            onClick={handleConfigure}
            disabled={!selectedFramework}
            title={!selectedFramework ? t('Select a framework to configure') : undefined}
          >
            {t('Configure SDK')}
          </Button>
        </Actions>
      </Footer>
    </Fragment>
  );
}

const Header = styled('header')`
  position: relative;
  height: 30px;

  margin: -${space(4)} -${space(2)} 0 -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(4)} -${space(4)} 0 -${space(4)};
  }
`;

const TopFrameworksImage = styled('img')`
  margin-bottom: ${space(2)};
`;

const Heading = styled('h6')`
  margin-bottom: ${space(1)};
  text-align: center;
`;

const Description = styled(TextBlock)`
  margin-bottom: ${space(2)};
  text-align: center;
`;

const Frameworks = styled(List)`
  max-height: 240px;
  overflow-y: auto;
`;

const Framework = styled(ListItem)`
  height: 40px;
  display: grid;
  text-align: left;
  cursor: pointer;
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const FrameworkIcon = styled(PlatformIcon)`
  border: 1px solid ${p => p.theme.innerBorder};
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

const Actions = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1)};
  width: 100%;
`;

export const modalCss = css`
  max-width: 400px;
  width: 100%;
`;
