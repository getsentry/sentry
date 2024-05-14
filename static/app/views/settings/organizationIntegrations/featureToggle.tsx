import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import Switch from 'sentry/components/switchButton';
import type {IntegrationWithConfig, Organization} from 'sentry/types';

export interface ToggleableFeature {
  disabledReason: string;
  help: string;
  initialState: boolean;
  label: string;
  name: string;
}

interface Props {
  configurations: IntegrationWithConfig[];
  features: ToggleableFeature[];
  onUpdate: (updatedConfigs: IntegrationWithConfig[]) => void;
  organization: Organization;
}

export default function FeatureToggleUpdater({
  configurations,
  organization,
  features,
  onUpdate,
}: Props) {
  const [featureToggles, setFeatureToggles] = useState<{[key: string]: boolean}>(
    features.reduce((acc, feature) => {
      acc[feature.name] = feature.initialState;
      return acc;
    }, {})
  );

  useEffect(() => {
    const baseEndpoint = `/organizations/${organization.slug}/integrations/`;
    const api = new Client();
    const updatedConfigs: IntegrationWithConfig[] = [];
    configurations.forEach(config => {
      if (!config.configData) {
        return;
      }

      const integrationConfigEndpoint = `${baseEndpoint}${config.id}/`;
      const updatedConfigData = {
        ...config.configData,
        toggleableFlags: featureToggles,
      };

      try {
        api.request(integrationConfigEndpoint, {
          method: 'POST',
          data: updatedConfigData,
        });
      } catch (error) {
        // Nothing to do here
      }
      updatedConfigs.push({
        ...config,
        configData: updatedConfigData,
      });
    });

    onUpdate(updatedConfigs);
    // eslint-disable-next-line
  }, [featureToggles]);

  const handleToggle = (featureName: string) => {
    setFeatureToggles(prevToggles => ({
      ...prevToggles,
      [featureName]: !prevToggles[featureName],
    }));
  };

  const renderSwitches = () => {
    const hasOrgWrite = organization.access.includes('org:write');
    return features.map(feature => (
      <ListItem key={feature.name}>
        <RightSwitch
          toggle={() => handleToggle(feature.name)}
          isActive={featureToggles[feature.name]}
          isDisabled={!hasOrgWrite}
          size="sm"
        />
        <Label>{feature.label}</Label>
        <HelpLabel text-muted>{feature.help}</HelpLabel>
      </ListItem>
    ));
  };

  return <List>{renderSwitches()}</List>;
}

const List = styled('ul')`
  list-style: none;
  padding: 0;
`;

const ListItem = styled('li')`
  margin-bottom: 10px;
  display: block;
`;

const Label = styled('div')`
  display: block;
  padding-bottom: 5px;
`;

const HelpLabel = styled('div')`
  display: block;
  padding-bottom: 5px;
  color: #80708f;
`;

const RightSwitch = styled(Switch)`
  padding-top: 3px;
  float: right;
`;
