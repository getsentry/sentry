import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';
import {PlatformIcon} from 'platformicons';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Radio} from '@sentry/scraps/radio';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {COLLAPSE_COUNT, CollapsePanel} from 'sentry/components/collapsePanel';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {ProjectCreationErrorAlert} from 'sentry/components/onboarding/projectCreationErrorAlert';
import {
  type ScmAnalyticsFlow,
  scmFlowVariantParams,
  trackScmPlatformSelected,
} from 'sentry/components/onboarding/scm/scmAnalyticsFlow';
import {
  useCreateProjectAndRulesError,
  useIsCreatingProjectAndRules,
} from 'sentry/components/onboarding/useCreateProjectAndRules';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {categoryList, createablePlatforms} from 'sentry/data/platformPickerCategories';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import {t, tn} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import type {PlatformIntegration} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

export enum SupportedLanguages {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  NODE = 'node',
  DOTNET = 'dotnet',
  JAVA = 'java',
  GO = 'go',
}

// SCM onboarding fires its modal-rendered and platform-selected events routed by
// the active flow (new-org onboarding vs SCM-first project creation).
const SCM_FRAMEWORK_MODAL_RENDERED_EVENT = {
  onboarding: 'onboarding.scm_select_framework_modal_rendered',
  'project-creation': 'project_creation.select_framework_modal_rendered',
} as const;

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
  /**
   * Whether the modal was opened from a shared SCM flow. `analyticsFlow`
   * distinguishes new-org onboarding from SCM-first project creation.
   */
  analyticsFlow?: ScmAnalyticsFlow;
  isScmFlow?: boolean;
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
  isScmFlow,
  analyticsFlow = 'onboarding',
}: FrameworkSuggestionModalProps) {
  const isCreatingProjectAndRules = useIsCreatingProjectAndRules();
  const createProjectAndRulesError = useCreateProjectAndRulesError();

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
    if (isScmFlow) {
      trackAnalytics(SCM_FRAMEWORK_MODAL_RENDERED_EVENT[analyticsFlow], {
        platform: selectedPlatform.key,
        organization,
        ...scmFlowVariantParams(analyticsFlow),
      });
    } else if (newOrg) {
      trackAnalytics('onboarding.select_framework_modal_rendered', {
        platform: selectedPlatform.key,
        organization,
      });
    } else {
      // Legacy project-creation variant shares the base
      // project_creation.select_framework_modal_rendered name with the SCM
      // variant above; stamp variant:'legacy' so it isn't dropped from
      // variant-filtered queries.
      trackAnalytics('project_creation.select_framework_modal_rendered', {
        platform: selectedPlatform.key,
        organization,
        variant: 'legacy',
      });
    }
  }, [selectedPlatform.key, organization, newOrg, isScmFlow, analyticsFlow]);

  const handleConfigure = useCallback(
    (selectedFramework: OnboardingSelectedSDK) => {
      if (isScmFlow) {
        trackScmPlatformSelected(
          analyticsFlow,
          organization,
          selectedFramework.key,
          'manual'
        );
      } else if (newOrg) {
        trackAnalytics('onboarding.select_framework_modal_configure_sdk_button_clicked', {
          platform: selectedPlatform.key,
          framework: selectedFramework.key,
          organization,
        });
      } else {
        trackAnalytics(
          'project_creation.select_framework_modal_configure_sdk_button_clicked',
          {
            platform: selectedPlatform.key,
            framework: selectedFramework.key,
            organization,
            variant: 'legacy',
          }
        );
      }

      onConfigure(selectedFramework);
    },
    [selectedPlatform, organization, onConfigure, newOrg, isScmFlow, analyticsFlow]
  );

  const handleSkip = useCallback(() => {
    if (isScmFlow) {
      trackScmPlatformSelected(
        analyticsFlow,
        organization,
        selectedPlatform.key,
        'manual'
      );
    } else if (newOrg) {
      trackAnalytics('onboarding.select_framework_modal_skip_button_clicked', {
        platform: selectedPlatform.key,
        organization,
      });
    } else {
      trackAnalytics('project_creation.select_framework_modal_skip_button_clicked', {
        platform: selectedPlatform.key,
        organization,
        variant: 'legacy',
      });
    }
    onSkip();
  }, [selectedPlatform, organization, onSkip, newOrg, isScmFlow, analyticsFlow]);

  const handleSubmit = useCallback(
    (selectedFramework: OnboardingSelectedSDK) => {
      if (selectedFramework.key === selectedPlatform.key) {
        handleSkip();
      } else {
        handleConfigure(selectedFramework);
      }
    },
    [handleSkip, handleConfigure, selectedPlatform]
  );

  const debouncedSubmit = useMemo(
    () => debounce(handleSubmit, 2000, {leading: true, trailing: false}),
    [handleSubmit]
  );

  useEffect(() => () => debouncedSubmit.cancel(), [debouncedSubmit]);

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

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {framework: selectedPlatform.key},
    validators: {
      onDynamic: z.object({
        framework: z.enum(listEntriesWithVanilla.map(platform => platform.id)),
      }),
    },
    onSubmit: ({value}) => {
      if (isCreatingProjectAndRules) {
        return;
      }
      const platform = listEntriesWithVanilla.find(entry => entry.id === value.framework);
      if (!platform) {
        return;
      }
      debouncedSubmit({
        key: platform.id,
        type: platform.type,
        language: platform.language,
        category:
          categoryList.find(category => category.platforms?.has(platform.id))?.id ??
          'all',
        link: platform.link,
        name: platform.name,
      });
    },
  });

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
    <form.AppForm form={form}>
      <Header>
        <CloseButton onClick={closeModal} />
      </Header>
      <Body>
        <TopFrameworksImage frameworks={listEntries} />
        <Heading>{t('Do you use a framework?')}</Heading>
        <Description>{languageDescriptions[selectedPlatform.key]}</Description>
        <ProjectCreationErrorAlert error={createProjectAndRulesError} />
        <StyledPanel>
          <StyledPanelBody role="radiogroup" aria-label={t('Framework')}>
            <form.AppField name="framework">
              {field => (
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
                          {items.map((platform, index) => (
                            <PlatformListItem key={platform.id}>
                              <RadioLabel index={index}>
                                <RadioBox
                                  size="sm"
                                  autoFocus={platform.id === selectedPlatform.key}
                                  name={field.name}
                                  value={platform.id}
                                  checked={field.state.value === platform.id}
                                  onChange={() => field.handleChange(platform.id)}
                                  onBlur={field.handleBlur}
                                  onKeyDown={event => {
                                    // Radios do not consistently submit on Enter across browsers.
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      event.currentTarget.form?.requestSubmit();
                                    }
                                  }}
                                />
                                <PlatformListItemIcon
                                  size={24}
                                  platform={platform.id}
                                  alt=""
                                />
                                {platform.name}
                              </RadioLabel>
                            </PlatformListItem>
                          ))}
                        </PlatformList>
                        {showMoreButton && (
                          <ShowMoreButtonWrapper>{showMoreButton}</ShowMoreButtonWrapper>
                        )}
                      </Fragment>
                    );
                  }}
                </CollapsePanel>
              )}
            </form.AppField>
          </StyledPanelBody>
        </StyledPanel>
      </Body>
      <Footer>
        <form.SubmitButton
          busy={isCreatingProjectAndRules}
          disabled={isCreatingProjectAndRules}
        >
          {t('Configure SDK')}
        </form.SubmitButton>
      </Footer>
    </form.AppForm>
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
        alt=""
      />
      <TopFrameworkIcon
        size={84}
        platform={top3[2]!.id}
        angle={34}
        radius={8}
        offset={+74}
        format="lg"
        alt=""
      />
      <TopFrameworkIcon
        size={84}
        platform={top3[0]!.id}
        angle={0}
        radius={8}
        offset={0}
        format="lg"
        alt=""
      />
    </TopFrameworksImageWrapper>
  );
}

const Header = styled('header')`
  position: relative;
  height: 30px;

  margin: -${p => p.theme.space['3xl']} -${p => p.theme.space.xl}
    0 -${p => p.theme.space['2xl']};
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin: -${p => p.theme.space['3xl']} -${p => p.theme.space['3xl']}
      0 -${p => p.theme.space['3xl']};
  }
`;

const TopFrameworkIcon = styled(PlatformIcon, {
  shouldForwardProp: prop => prop !== 'angle' && prop !== 'offset',
})<{angle: number; offset: number}>`
  transform: translate(calc(-50% + ${p => p.offset}px), -50%) rotate(${p => p.angle}deg);
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

const TopFrameworksImageWrapper = styled('div')`
  position: relative;
  width: 256px;
  height: 108px;
  min-height: 108px;
  margin: 0px auto ${p => p.theme.space.xl};
`;

const Heading = styled('h6')`
  margin-bottom: ${p => p.theme.space.md};
  text-align: center;
`;

const Description = styled(TextBlock)`
  margin-bottom: ${p => p.theme.space.xl};
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
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const PlatformListItemIcon = styled(PlatformIcon)`
  border: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const RadioLabel = styled(RadioLineItem)`
  display: inline-grid;
  grid-template-columns: max-content max-content 1fr;
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  gap: ${p => p.theme.space.lg};
  input {
    cursor: pointer;
  }
`;

const RadioBox = styled(Radio)`
  padding: ${p => p.theme.space.xs};
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
  [role='document'] > form {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  section {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  max-width: 400px;
  width: 100%;
`;
