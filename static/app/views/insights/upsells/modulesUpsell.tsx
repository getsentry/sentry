import styled from '@emotion/styled';

import appStartPreviewImg from 'sentry-images/insights/module-upsells/insights-app-starts-module-upsell.svg';
import assetsPreviewImg from 'sentry-images/insights/module-upsells/insights-assets-module-upsell.svg';
import cachesPreviewImg from 'sentry-images/insights/module-upsells/insights-caches-module-upsell.svg';
import llmPreviewImg from 'sentry-images/insights/module-upsells/insights-llm-module-upsell.svg';
import upsellImage from 'sentry-images/insights/module-upsells/insights-module-upsell.svg';
import queriesPreviewImg from 'sentry-images/insights/module-upsells/insights-queries-module-upsell.svg';
import queuesPreviewImg from 'sentry-images/insights/module-upsells/insights-queues-module-upsell.svg';
import requestPreviewImg from 'sentry-images/insights/module-upsells/insights-requests-module-upsell.svg';
import screenLoadsPreviewImg from 'sentry-images/insights/module-upsells/insights-screen-loads-module-upsell.svg';
import webVitalsPreviewImg from 'sentry-images/insights/module-upsells/insights-web-vitals-module-upsell.svg';

import {LinkButton} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {SidebarNavigationItemHook} from 'sentry/components/sidebar/sidebarItem';
import {IconBusiness, IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';
import {useModuleTitle} from 'sentry/views/insights/common/utils/useModuleTitle';

const SUBTITLE = t(
  'Content about Insights goes in here dolor sit amet, consectetur adipiscing elit. Viva mus iaculis convallis tellus a rhoncus sit amet tincidunt risus, sedvel. Learn more'
);
const TITLE = t('Start monitoring your insights');

export function ModulesUpsell({selectedModule}: {selectedModule: TitleableModuleNames}) {
  const organization = useOrganization();

  const modulePreview = modulePreviews[selectedModule];
  const checkoutUrl = `/settings/${organization.slug}/billing/checkout/?referrer=upsell-insights-${selectedModule}`;

  return (
    <Layout.Page>
      <Container>
        <ModuleLayout.Layout>
          <ModuleLayout.Half>
            <Title>{TITLE}</Title>
            {SUBTITLE}
            <Flex>
              <FlexItem>
                <ModuleNameList selectedModule={selectedModule} />
              </FlexItem>
              <FlexItem>{modulePreview}</FlexItem>
            </Flex>
          </ModuleLayout.Half>
          <ModuleLayout.Half>
            <PerfImage src={upsellImage} />
          </ModuleLayout.Half>
          <LinkButton to priority="primary">
            Start Free Trial
          </LinkButton>
          <LinkButton to={checkoutUrl} priority="default">
            Upgrade Now
          </LinkButton>
        </ModuleLayout.Layout>
      </Container>
    </Layout.Page>
  );
}

function ModuleNameList({selectedModule}: {selectedModule: TitleableModuleNames}) {
  // TODO - it would be nice if this list was dynamic based on the sidebar items
  const commonProps = {selectedModule};

  return (
    <StyledList>
      <ModuleNameListItem moduleName="http" {...commonProps} />
      <ModuleNameListItem moduleName="db" {...commonProps} />
      <ModuleNameListItem moduleName="resource" {...commonProps} />
      <ModuleNameListItem moduleName="app_start" {...commonProps} />
      <ModuleNameListItem moduleName="screen_load" {...commonProps} />
      <ModuleNameListItem moduleName="vital" {...commonProps} />
      <ModuleNameListItem moduleName="cache" {...commonProps} />
      <ModuleNameListItem moduleName="queue" {...commonProps} />
      <ModuleNameListItem moduleName="ai" {...commonProps} />
    </StyledList>
  );
}

function ModuleNameListItem({
  moduleName,
  selectedModule,
}: {
  moduleName: TitleableModuleNames;
  selectedModule: TitleableModuleNames;
}) {
  const moduleTitle = useModuleTitle(moduleName);
  const isSelected = selectedModule === moduleName;

  return (
    <SidebarNavigationItemHook id={sidebarIdMap[moduleName]}>
      {({disabled}) => (
        <StyledListItem isSelected={isSelected}>
          {disabled ? <IconBusiness /> : <IconCheckmark />} {moduleTitle}
        </StyledListItem>
      )}
    </SidebarNavigationItemHook>
  );
}

const Flex = styled('div')`
  padding-top: ${space(4)};
  display: flex;
  width: 100%;
`;

const PreviewImage = styled('img')`
  max-width: 100%;
  margin-top: ${space(2)};
`;

const FlexItem = styled('div')`
  width: 100%;
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.border};
    padding-left: ${space(2)};
  }
`;

const StyledList = styled('ul')`
  list-style-type: none;
  margin: 0;
`;

const StyledListItem = styled('li')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  :not(:last-child) {
    margin-bottom: ${space(2)};
  }
  ${p => p.isSelected && `font-weight: ${p.theme.fontWeightBold};`}
`;

const Title = styled('h2')`
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: ${space(1)};
`;

const PerfImage = styled('img')`
  width: 350px;
  user-select: none;
  bottom: 0;
  right: 0;
  padding-right: ${space(1)};
`;

const Container = styled('div')`
  height: 100%;
  width: 100%;
  padding: 100px;
`;

const modulePreviews: Record<TitleableModuleNames, React.ReactNode> = {
  app_start: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={appStartPreviewImg} />
    </div>
  ),
  ai: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={llmPreviewImg} />
    </div>
  ),
  'mobile-ui': (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={screenLoadsPreviewImg} />
    </div>
  ),
  cache: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={cachesPreviewImg} />
    </div>
  ),
  db: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={queriesPreviewImg} />
    </div>
  ),
  http: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={requestPreviewImg} />
    </div>
  ),
  resource: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={assetsPreviewImg} />
    </div>
  ),
  screen_load: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={screenLoadsPreviewImg} />
    </div>
  ),
  vital: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={webVitalsPreviewImg} />
    </div>
  ),
  queue: (
    <div>
      <div>
        {t(
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus iaculis convallistellus a rhonc ussit amet tinci dunt risus, sed bibendum vel'
        )}
      </div>
      <PreviewImage src={queuesPreviewImg} />
    </div>
  ),
};

// This matches ids in the sidebar items and in the hook in getsentry
export const sidebarIdMap: Record<TitleableModuleNames, string> = {
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
};
