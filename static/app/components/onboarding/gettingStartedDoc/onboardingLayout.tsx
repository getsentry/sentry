import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {Docs, DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

const ProductSelectionAvailabilityHook = HookOrDefault({
  hookName: 'component:product-selection-availability',
  defaultComponent: ProductSelection,
});

export type OnboardingLayoutProps = {
  docsConfig: Docs<any>;
  dsn: string;
  platformKey: PlatformKey;
  projectId: Project['id'];
  projectSlug: Project['slug'];
  activeProductSelection?: ProductSolution[];
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
}: OnboardingLayoutProps) {
  const organization = useOrganization();
  const {isLoading: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);
  const selectedOptions = useUrlPlatformOptions(docsConfig.platformOptions);

  const {platformOptions} = docsConfig;

  const {introduction, steps, nextSteps} = useMemo(() => {
    const {onboarding} = docsConfig;

    const docParams: DocsParams<any> = {
      dsn,
      organization,
      platformKey,
      projectId,
      projectSlug,
      isPerformanceSelected: activeProductSelection.includes(
        ProductSolution.PERFORMANCE_MONITORING
      ),
      isProfilingSelected: activeProductSelection.includes(ProductSolution.PROFILING),
      isReplaySelected: activeProductSelection.includes(ProductSolution.SESSION_REPLAY),
      sourcePackageRegistries: {
        isLoading: isLoadingRegistry,
        data: registryData,
      },
      platformOptions: selectedOptions,
      newOrg,
    };

    return {
      introduction: onboarding.introduction?.(docParams),
      steps: [
        ...onboarding.install(docParams),
        ...onboarding.configure(docParams),
        ...onboarding.verify(docParams),
      ],
      nextSteps: onboarding.nextSteps?.(docParams) || [],
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
  ]);

  return (
    <AuthTokenGeneratorProvider projectSlug={projectSlug}>
      <Wrapper>
        <Header>
          {introduction && <div>{introduction}</div>}
          <ProductSelectionAvailabilityHook
            organization={organization}
            platform={platformKey}
          />
          {platformOptions ? (
            <PlatformOptionsControl platformOptions={platformOptions} />
          ) : null}
        </Header>
        <Divider withBottomMargin />
        <Steps>
          {steps.map(step => (
            <Step key={step.title ?? step.type} {...step} />
          ))}
        </Steps>
        {nextSteps.length > 0 && (
          <Fragment>
            <Divider />
            <h4>{t('Next Steps')}</h4>
            <List symbol="bullet">
              {nextSteps.map(step => (
                <ListItem key={step.name}>
                  <ExternalLink href={step.link}>{step.name}</ExternalLink>
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

const Steps = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
