import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import upsellImage from 'getsentry-images/features/insights/module-upsells/insights-module-upsell.svg';

import appStartPreviewImg from 'sentry-images/insights/module-upsells/insights-app-starts-module-charts.svg';
import assetsPreviewImg from 'sentry-images/insights/module-upsells/insights-assets-module-charts.svg';
import cachesPreviewImg from 'sentry-images/insights/module-upsells/insights-caches-module-charts.svg';
import llmPreviewImg from 'sentry-images/insights/module-upsells/insights-llm-module-charts.svg';
import queriesPreviewImg from 'sentry-images/insights/module-upsells/insights-queries-module-charts.svg';
import queuesPreviewImg from 'sentry-images/insights/module-upsells/insights-queues-module-charts.svg';
import requestPreviewImg from 'sentry-images/insights/module-upsells/insights-requests-module-charts.svg';
import screenLoadsPreviewImg from 'sentry-images/insights/module-upsells/insights-screen-loads-module-charts.svg';
import screenRenderingPreviewImg from 'sentry-images/insights/module-upsells/insights-screen-rendering-module-charts.svg';
import webVitalsPreviewImg from 'sentry-images/insights/module-upsells/insights-web-vitals-module-charts.svg';

import {Button, LinkButton} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconBusiness, IconCheckmark} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';
import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';
import {MODULE_TITLES} from 'sentry/views/insights/settings';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {
  type InsightSidebarId,
  InsightsItemAccessRule,
} from 'getsentry/components/sidebarNavigationItem';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import {SidebarFooter} from 'getsentry/components/upsellModal/footer';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Subscription} from 'getsentry/types';
import {getFriendlyPlanName} from 'getsentry/utils/billing';

const SUBTITLE = t(
  'Insights give you a deeper understanding of your application’s frontend and backend dependencies so you can easily create software that’s performant, reliable, and that people want to use.'
);
const TITLE = t('Find out why your application is mad at you');

interface Props {
  children: React.ReactNode;
  moduleName: TitleableModuleNames;
  organization: Organization;
  subscription: Subscription;
  fullPage?: boolean; // This prop is temporary while we transition to domain views for performance
}

type ModuleNameClickHandler = (module: TitleableModuleNames) => void;

/** @internal exported for tests only */
export function InsightsUpsellPage({
  moduleName,
  fullPage,
  subscription,
  children,
}: Props) {
  const hasRequiredFeatures = useHasRequiredInsightFeatures(moduleName, subscription);

  if (hasRequiredFeatures) {
    return children;
  }
  return (
    <UpsellPage
      defaultModule={moduleName}
      subscription={subscription}
      fullPage={fullPage ?? true}
    />
  );
}

const useHasRequiredInsightFeatures = (
  moduleName: TitleableModuleNames,
  subscription: Subscription
) => {
  const id = sidebarIdMap[moduleName];
  const organization = useOrganization();
  const {data: billingConfig} = useBillingConfig({organization, subscription});

  // if there's no sidebar id mapping, the module isn't bound to any feature,
  // so let's just show it
  if (id === undefined) {
    return true;
  }
  const subscriptionPlan = subscription.planDetails;
  const subscriptionPlanFeatures = subscriptionPlan?.features ?? [];

  const trialPlan = subscription.trialPlan
    ? billingConfig?.planList?.find(plan => plan.id === subscription.trialPlan)
    : undefined;
  const trialPlanFeatures = trialPlan?.features ?? [];

  const planFeatures = [...new Set([...subscriptionPlanFeatures, ...trialPlanFeatures])];
  const rule = new InsightsItemAccessRule(id, organization, planFeatures);
  return rule.hasRequiredFeatures;
};

function UpsellPage({
  defaultModule,
  subscription,
  fullPage,
}: {
  defaultModule: TitleableModuleNames;
  fullPage: boolean;
  subscription: Subscription;
}) {
  if (fullPage) {
    return (
      <FullPageContainer>
        <Content defaultModule={defaultModule} subscription={subscription} />
      </FullPageContainer>
    );
  }
  return (
    <Background>
      <StyledPanel>
        <ContentContainer>
          <Content defaultModule={defaultModule} subscription={subscription} />
        </ContentContainer>
      </StyledPanel>
    </Background>
  );
}

function Content({
  defaultModule,
  subscription,
}: {
  defaultModule: TitleableModuleNames;
  subscription: Subscription;
}) {
  const organization = useOrganization();
  const [selectedModule, setSelectedModule] =
    useState<TitleableModuleNames>(defaultModule);
  const modulePreviewContent = MODULE_PREVIEW_CONTENT[selectedModule];
  const checkoutUrl = normalizeUrl(
    `/settings/${organization.slug}/billing/checkout/?referrer=upsell-insights-${selectedModule}`
  );
  const source = 'insight-product-trial';
  const canTrial = subscription.canTrial;

  return (
    <Fragment>
      <PageLayout>
        <MainContent>
          <Title>{TITLE}</Title>
          {SUBTITLE}
          <SplitMainContent>
            <FeatureListContainer>
              <ModuleNameList
                selectedModule={selectedModule}
                subscription={subscription}
                onModuleNameClick={moduleName => setSelectedModule(moduleName)}
              />
            </FeatureListContainer>
            <ModulePreviewContainer>
              {modulePreviewContent?.description}
              {modulePreviewContent && (
                <PreviewImage src={modulePreviewContent.imageSrc} />
              )}
            </ModulePreviewContainer>
          </SplitMainContent>
        </MainContent>
        <Sidebar>
          <UpsellImage src={upsellImage} />
          <StyledSidebarFooter>
            <h1>{t('Current Plan')}</h1>
            <h2>{getFriendlyPlanName(subscription)}</h2>
            <a href="https://sentry.io/pricing" target="_blank" rel="noopener noreferrer">
              {t('Learn more and compare plans')}
            </a>
          </StyledSidebarFooter>
        </Sidebar>
      </PageLayout>
      <ButtonContainer>
        <UpgradeOrTrialButton
          subscription={subscription}
          priority="primary"
          organization={organization}
          source={source}
          aria-label="Start Trial"
        />
        {canTrial && <LinkButton to={checkoutUrl}>Upgrade Now</LinkButton>}
        {!canTrial && (
          <Button
            onClick={() =>
              openUpsellModal({
                organization,
                source,
                defaultSelection: 'insights-modules',
              })
            }
          >
            {t('Learn More')}
          </Button>
        )}
      </ButtonContainer>
    </Fragment>
  );
}

function ModuleNameList({
  selectedModule,
  subscription,
  onModuleNameClick,
}: {
  onModuleNameClick: ModuleNameClickHandler;
  selectedModule: TitleableModuleNames;
  subscription: Subscription;
}) {
  // TODO - it would be nice if this list was dynamic based on the sidebar items
  const commonProps = {selectedModule, subscription, onModuleNameClick};

  return (
    <FeatureList>
      <ModuleNameListItem moduleName="http" {...commonProps} />
      <ModuleNameListItem moduleName="db" {...commonProps} />
      <ModuleNameListItem moduleName="resource" {...commonProps} />
      <ModuleNameListItem moduleName="app_start" {...commonProps} />
      <ModuleNameListItem moduleName="screen_load" {...commonProps} />
      <ModuleNameListItem moduleName="vital" {...commonProps} />
      <ModuleNameListItem moduleName="cache" {...commonProps} />
      <ModuleNameListItem moduleName="queue" {...commonProps} />
      <ModuleNameListItem moduleName="ai" {...commonProps} />
      <ModuleNameListItem moduleName="screen-rendering" {...commonProps} />
    </FeatureList>
  );
}

function ModuleNameListItem({
  moduleName,
  selectedModule,
  subscription,
  onModuleNameClick,
}: {
  moduleName: TitleableModuleNames;
  onModuleNameClick: ModuleNameClickHandler;
  selectedModule: TitleableModuleNames;
  subscription: Subscription;
}) {
  const moduleTitle = MODULE_TITLES[moduleName];
  const hasRequiredFeatures = useHasRequiredInsightFeatures(moduleName, subscription);
  const isSelected = selectedModule === moduleName;
  const iconProps: SVGIconProps = {
    size: 'md',
    color: isSelected ? undefined : 'gray200',
  };

  return (
    <FeatureListItem
      isSelected={isSelected}
      onClick={() => onModuleNameClick(moduleName)}
    >
      {hasRequiredFeatures ? (
        <IconCheckmark {...iconProps} />
      ) : (
        <IconBusiness {...iconProps} />
      )}{' '}
      {moduleTitle}
    </FeatureListItem>
  );
}

const PageLayout = styled('div')`
  display: flex;
  align-items: stretch;
  gap: ${space(4)};
  padding-bottom: ${space(4)};
`;

const MainContent = styled('div')`
  flex: 5;
`;

const Title = styled('h2')`
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: ${space(1)};
`;

const Sidebar = styled('div')`
  position: relative;
  flex: 3;
`;

const flexGap = space(2);

const SplitMainContent = styled('div')`
  display: flex;
  border-radius: 10px;
  padding: ${space(4)};
  margin-top: ${space(2)};
  gap: ${flexGap};
  justify-content: space-between;
  background-color: ${p => p.theme.backgroundElevated};
  width: 100%;
`;

const FeatureListContainer = styled('div')`
  width: 100%;
  white-space: nowrap;
  flex: 1;
`;

const ModulePreviewContainer = styled('div')`
  border-left: 1px solid ${p => p.theme.border};
  padding-left: ${flexGap};
`;

const FeatureList = styled('ul')`
  display: flex;
  row-gap: ${space(1.5)};
  flex-direction: column;
  list-style-type: none;
  margin: 0;
  padding: 0;
`;

const FeatureListItem = styled('li')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  color: ${p => (p.isSelected ? p.theme.gray500 : p.theme.gray300)};
  ${p => p.isSelected && `font-weight: ${p.theme.fontWeightBold};`}
  cursor: pointer;
  :hover {
    color: ${p => p.theme.gray500};
  }
`;

const PreviewImage = styled('img')`
  max-width: 70%;
  display: block;
  margin: auto;
`;

const UpsellImage = styled('img')`
  width: 100%;
`;

const Background = styled('div')`
  background-color: ${p => p.theme.background};
  height: 100%;
`;

const ContentContainer = styled('div')`
  max-width: 1800px;
  margin: 0 auto;
  height: 100%;
  width: 100%;
  padding: ${space(4)};
`;

const StyledPanel = styled(Panel)`
  margin: ${space(3)} ${space(4)};
`;

const FullPageContainer = styled('div')`
  max-width: 1800px;
  margin: 0 auto;
  height: 100%;
  width: 100%;
  padding: 100px;
`;

const StyledSidebarFooter = styled(SidebarFooter)`
  position: absolute;
  border-left: 8px solid ${p => p.theme.border};
  padding-left: ${space(2)};
  bottom: 0;
`;

const ButtonContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const MODULE_PREVIEW_CONTENT: Partial<
  Record<TitleableModuleNames, {description: string; imageSrc: any}>
> = {
  app_start: {
    description: t('Improve the latency associated with your application starting up.'),
    imageSrc: appStartPreviewImg,
  },
  ai: {
    description: t(
      'Get insights into critical metrics, like token usage, to monitor and fix issues with AI pipelines.'
    ),
    imageSrc: llmPreviewImg,
  },
  'mobile-ui': {
    description: t(
      'View the most active screens in your mobile application and monitor your releases for TTID and TTFD regressions.'
    ),
    imageSrc: screenLoadsPreviewImg,
  },
  cache: {
    description: t(
      'Discover whether your application is utilizing caching effectively and understand the latency associated with cache misses.'
    ),
    imageSrc: cachesPreviewImg,
  },
  db: {
    description: t(
      'Investigate the performance of database queries and get the information necessary to improve them.'
    ),
    imageSrc: queriesPreviewImg,
  },
  http: {
    description: t(
      'Monitor outgoing HTTP requests and investigate errors and performance bottlenecks tied to domains.'
    ),
    imageSrc: requestPreviewImg,
  },
  resource: {
    description: t(
      'Find large and slow-to-load resources used by your application and understand their impact on page performance.'
    ),
    imageSrc: assetsPreviewImg,
  },
  vital: {
    description: t(
      'Get a set of metrics telling you the quality of user experience on a web page and see what needs improving.'
    ),
    imageSrc: webVitalsPreviewImg,
  },
  queue: {
    description: t(
      'Understand the health and performance impact that queues have on your application and diagnose errors tied to jobs.'
    ),
    imageSrc: queuesPreviewImg,
  },
  screen_load: {
    description: t(
      'View the most active screens in your mobile application and monitor your releases for TTID and TTFD regressions.'
    ),
    imageSrc: screenLoadsPreviewImg,
  },
  'screen-rendering': {
    description: t(
      'Screen Rendering identifies slow and frozen interactions, helping you find and fix problems that might cause users to complain, or uninstall.'
    ),
    imageSrc: screenRenderingPreviewImg,
  },
};

// This matches ids in the sidebar items and in the hook in getsentry
const sidebarIdMap: Partial<Record<TitleableModuleNames, InsightSidebarId>> = {
  ai: 'llm-monitoring',
  'mobile-ui': 'performance-mobile-ui',
  cache: 'performance-cache',
  db: 'performance-database',
  http: 'performance-http',
  resource: 'performance-browser-resources',
  screen_load: 'performance-mobile-screens',
  app_start: 'performance-mobile-app-startup',
  vital: 'performance-webvitals',
  queue: 'performance-queues',
  'screen-rendering': 'performance-screen-rendering',
};

export default withOrganization(withSubscription(InsightsUpsellPage, {noLoader: true}));
