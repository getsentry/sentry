import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  ConfigType,
  Docs,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {
  PlatformOptionsControl,
  useUrlPlatformOptions,
} from 'sentry/components/onboarding/platformOptionsControl';
import {
  ProductSelection,
  ProductSolution,
} from 'sentry/components/onboarding/productSelection';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project, ProjectKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const ProductSelectionAvailabilityHook = HookOrDefault({
  hookName: 'component:product-selection-availability',
  defaultComponent: ProductSelection,
});

export type OnboardingLayoutProps = {
  docsConfig: Docs<any>;
  dsn: ProjectKey['dsn'];
  platformKey: PlatformKey;
  projectId: Project['id'];
  projectKeyId: ProjectKey['id'];
  projectSlug: Project['slug'];
  activeProductSelection?: ProductSolution[];
  configType?: ConfigType;
  newOrg?: boolean;
};

const EMPTY_ARRAY: never[] = [];

export function OnboardingLayout({
  docsConfig,
  dsn,
  platformKey,
  projectId,
  projectSlug,
  activeProductSelection = EMPTY_ARRAY,
  newOrg,
  projectKeyId,
  configType = 'onboarding',
}: OnboardingLayoutProps) {
  const api = useApi();
  const organization = useOrganization();
  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);
  const {platformOptions} = docsConfig;
  const {urlPrefix, isSelfHosted} = useLegacyStore(ConfigStore);

  const {
    introduction,
    steps,
    nextSteps,
    onPlatformOptionsChange,
    onProductSelectionChange,
    onPageLoad,
    onProductSelectionLoad,
  } = useMemo(() => {
    const doc = docsConfig[configType] ?? docsConfig.onboarding;

    const docParams: DocsParams<any> = {
      api,
      projectKeyId,
      dsn,
      organization,
      platformKey,
      projectId,
      projectSlug,
      isFeedbackSelected: false,
      isPerformanceSelected: activeProductSelection.includes(
        ProductSolution.PERFORMANCE_MONITORING
      ),
      isProfilingSelected: activeProductSelection.includes(ProductSolution.PROFILING),
      isReplaySelected: activeProductSelection.includes(ProductSolution.SESSION_REPLAY),
      sourcePackageRegistries: {
        isLoading: isLoadingRegistry,
        data: registryData,
      },
      urlPrefix,
      isSelfHosted,
      platformOptions: selectedOptions,
      newOrg,
      profilingOptions: {
        defaultProfilingMode: organization.features.includes('continuous-profiling')
          ? 'continuous'
          : 'transaction',
      },
      replayOptions: {block: true, mask: true},
    };

    return {
      introduction: doc.introduction?.(docParams),
      steps: [
        ...doc.install(docParams),
        ...doc.configure(docParams),
        ...doc.verify(docParams),
      ],
      nextSteps: doc.nextSteps?.(docParams) || [],
      onPlatformOptionsChange: doc.onPlatformOptionsChange?.(docParams),
      onProductSelectionChange: doc.onProductSelectionChange?.(docParams),
      onProductSelectionLoad: doc.onProductSelectionLoad?.(docParams),
      onPageLoad: doc.onPageLoad?.(docParams),
    };
  }, [
    activeProductSelection,
    docsConfig,
    dsn,
    isLoadingRegistry,
    newOrg,
    organization,
    platformKey,
    projectId,
    projectSlug,
    registryData,
    selectedOptions,
    configType,
    urlPrefix,
    isSelfHosted,
    api,
    projectKeyId,
  ]);

  useEffect(() => {
    onPageLoad?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        <Header>
          {introduction && <Introduction>{introduction}</Introduction>}
          {configType === 'onboarding' && (
            <ProductSelectionAvailabilityHook
              organization={organization}
              platform={platformKey}
              onChange={onProductSelectionChange}
              onLoad={onProductSelectionLoad}
            />
          )}
          {platformOptions && !['customMetricsOnboarding'].includes(configType) ? (
            <PlatformOptionsControl
              platformOptions={platformOptions}
              onChange={onPlatformOptionsChange}
            />
          ) : null}
        </Header>
        <Divider withBottomMargin />
        <div>
          {steps.map(step => (
            <StyledStep key={step.title ?? step.type} {...step} />
          ))}
        </div>
        {nextSteps.length > 0 && (
          <Fragment>
            <Divider />
            <h4>{t('Additional Information')}</h4>
            <List symbol="bullet">
              {nextSteps
                .filter((step): step is Exclude<typeof step, null> => step !== null)
                .map(step => (
                  <ListItem key={step.name}>
                    <ExternalLink
                      href={step.link}
                      onClick={() =>
                        trackAnalytics('onboarding.next_step_clicked', {
                          organization,
                          platform: platformKey,
                          project_id: projectId,
                          products: activeProductSelection,
                          step: step.name,
                          newOrg: newOrg ?? false,
                        })
                      }
                    >
                      {step.name}
                    </ExternalLink>
                    {': '}
                    {step.description}
                  </ListItem>
                ))}
            </List>
          </Fragment>
        )}
      </Wrapper>
    </AuthTokenGeneratorProvider>
  );
}

const Header = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const Divider = styled('hr')<{withBottomMargin?: boolean}>`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
  ${p => p.withBottomMargin && `margin-bottom: ${space(3)}`}
`;

const StyledStep = styled(Step)`
  :not(:last-child) {
    margin-bottom: 1.5rem;
  }
`;

const Wrapper = styled('div')`
  h4 {
    margin-bottom: 0.5em;
  }
  && {
    p {
      margin-bottom: 0;
    }
    h5 {
      margin-bottom: 0;
    }
  }
`;

const Introduction = styled('div')`
  & > p:not(:last-child) {
    margin-bottom: ${space(2)};
  }
`;
