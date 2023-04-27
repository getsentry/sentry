import {Fragment, useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import onboardingFrameworkSelectionJavascript from 'sentry-images/spot/onboarding-framework-selection-javascript.svg';
import onboardingFrameworkSelectionNode from 'sentry-images/spot/onboarding-framework-selection-node.svg';
import onboardingFrameworkSelectionPython from 'sentry-images/spot/onboarding-framework-selection-python.svg';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Panel, PanelBody} from 'sentry/components/panels';
import Radio from 'sentry/components/radio';
import categoryList from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingSelectedSDK, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export enum SUPPORTED_LANGUAGES {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  NODE = 'node',
}

export const languageDetails = {
  [SUPPORTED_LANGUAGES.JAVASCRIPT]: {
    description: t(
      'Our JavaScript framework SDK’s include all the features of our Browser Javascript SDK with additional features specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionJavascript,
  },
  [SUPPORTED_LANGUAGES.NODE]: {
    description: t(
      'Our Node framework SDK’s include all the features of our Node SDK with instructions specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionNode,
  },
  [SUPPORTED_LANGUAGES.PYTHON]: {
    description: t(
      'Our Python framework SDK’s include all the features of our Python SDK with instructions specific to that framework'
    ),
    topFrameworksImage: onboardingFrameworkSelectionPython,
  },
};

type Props = ModalRenderProps & {
  onConfigure: (selectedFramework: OnboardingSelectedSDK) => void;
  onSkip: () => void;
  organization: Organization;
  selectedPlatform: OnboardingSelectedSDK;
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
}: Props) {
  const [selectedFramework, setSelectedFramework] = useState<
    OnboardingSelectedSDK | undefined
  >(undefined);

  const frameworks = platforms.filter(
    platform =>
      platform.type === 'framework' && platform.language === selectedPlatform.key
  );

  useEffect(() => {
    trackAnalytics('onboarding.select_framework_modal_rendered', {
      platform: selectedPlatform.key,
      organization,
    });
  }, [selectedPlatform.key, organization]);

  const handleConfigure = useCallback(() => {
    if (!selectedFramework) {
      return;
    }
    trackAnalytics('onboarding.select_framework_modal_configure_sdk_button_clicked', {
      platform: selectedPlatform.key,
      framework: selectedFramework.key,
      organization,
    });

    onConfigure(selectedFramework);
    closeModal();
  }, [selectedPlatform, selectedFramework, organization, onConfigure, closeModal]);

  const handleSkip = useCallback(() => {
    trackAnalytics('onboarding.select_framework_modal_skip_button_clicked', {
      platform: selectedPlatform.key,
      organization,
    });
    onSkip();
    closeModal();
  }, [selectedPlatform, organization, closeModal, onSkip]);

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
              {frameworks.map((framework, index) => {
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
              })}
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
