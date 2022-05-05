import * as React from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import Button from 'sentry/components/button';
import Tag from 'sentry/components/tag';
import {IconClose, IconOpen} from 'sentry/icons';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';
import {IntegrationProvider, Organization} from 'sentry/types';
import {
  getCategories,
  getIntegrationFeatureGate,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import withOrganization from 'sentry/utils/withOrganization';
import AddIntegrationButton from 'sentry/views/organizationIntegrations/addIntegrationButton';
import {INSTALLED, NOT_INSTALLED} from 'sentry/views/organizationIntegrations/constants';
import IntegrationStatus from 'sentry/views/organizationIntegrations/integrationStatus';

type Props = {
  isInstalled: boolean;
  organization: Organization;
  provider: IntegrationProvider;
  setIntegrationInstalled: () => void;
};

function IntegrationInstaller({
  isInstalled,
  provider,
  setIntegrationInstalled,
  organization,
}: Props) {
  const installationStatus = isInstalled ? INSTALLED : NOT_INSTALLED;
  const featureData = provider.metadata.features;
  const tags = getCategories(featureData);
  const features = featureData.map(f => ({
    featureGate: f.featureGate,
    description: (
      <FeatureListItem
        dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}}
      />
    ),
  }));
  const {IntegrationFeatures, FeatureList} = getIntegrationFeatureGate();
  const {metadata, slug} = provider;
  const featureProps = {organization, features};
  const installButton = (disabled: boolean) => {
    const buttonProps = {
      style: {marginBottom: space(1)},
      size: 'small' as const,
      priority: 'primary' as const,
      'data-test-id': 'install-button',
      disabled,
      organization,
    };
    // must be installed externally
    if (metadata.aspects.externalInstall) {
      return (
        <Button
          icon={<IconOpen />}
          href={metadata.aspects.externalInstall.url}
          onClick={() =>
            trackIntegrationAnalytics('integrations.installation_start', {
              integration: slug,
              integration_type: 'first_party',
              already_installed: isInstalled,
              organization,
              view: 'onboarding',
            })
          }
          external
          {...buttonProps}
        >
          {metadata.aspects.externalInstall.buttonText}
        </Button>
      );
    }
    return (
      <AddIntegrationButton
        provider={provider}
        onAddIntegration={() => setIntegrationInstalled()}
        analyticsParams={{
          view: 'onboarding',
          already_installed: isInstalled,
        }}
        {...buttonProps}
      />
    );
  };
  return (
    <Wrapper>
      <TopSectionWrapper>
        <Flex>
          <PluginIcon pluginId={provider.slug} size={50} />
          <NameContainer>
            <Flex>
              <Name>{provider.name}</Name>
              <StatusWrapper>
                <IntegrationStatus status={installationStatus} />
              </StatusWrapper>
            </Flex>
            <Flex>
              {tags.map(feature => (
                <StyledTag key={feature}>{startCase(feature)}</StyledTag>
              ))}
            </Flex>
          </NameContainer>
        </Flex>
        <Flex>
          <IntegrationFeatures {...featureProps}>
            {({disabled, disabledReason}) => (
              <DisableWrapper>
                {installButton(disabled)}
                {disabled && <DisabledNotice reason={disabledReason} />}
              </DisableWrapper>
            )}
          </IntegrationFeatures>
        </Flex>
      </TopSectionWrapper>

      <Flex>
        <FlexContainer>
          <Description dangerouslySetInnerHTML={{__html: marked(metadata.description)}} />
          <FeatureList {...featureProps} provider={{key: slug}} />
        </FlexContainer>
      </Flex>
    </Wrapper>
  );
}

export default withOrganization(IntegrationInstaller);

const Wrapper = styled('div')``;

const Flex = styled('div')`
  display: flex;
`;

const FlexContainer = styled('div')`
  flex: 1;
`;

const Description = styled('div')`
  li {
    margin-bottom: 6px;
  }
`;

const TopSectionWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const NameContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding-left: ${space(2)};
`;

const StyledTag = styled(Tag)`
  text-transform: none;
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
`;

const Name = styled('div')`
  font-weight: bold;
  font-size: 1.4em;
  margin-bottom: ${space(1)};
`;

const StatusWrapper = styled('div')`
  margin-bottom: ${space(1)};
  padding-left: ${space(2)};
  line-height: 1.5em;
`;

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
    }}
    {...p}
  >
    <IconCloseCircle isCircled />
    <span>{reason}</span>
  </div>
))`
  padding-top: ${space(0.5)};
  font-size: 0.9em;
`;

const DisableWrapper = styled('div')`
  margin-left: auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const IconCloseCircle = styled(IconClose)`
  color: ${p => p.theme.red300};
  margin-right: ${space(1)};
`;

const FeatureListItem = styled('span')`
  line-height: 24px;
`;
