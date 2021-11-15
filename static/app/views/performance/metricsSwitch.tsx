import {createContext, ReactNode, useContext, useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import Switch from 'app/components/switchButton';
import {t} from 'app/locale';
import space from 'app/styles/space';
import localStorage from 'app/utils/localStorage';
import useOrganization from 'app/utils/useOrganization';

const FEATURE_FLAG = 'metrics-performance-ui';

/**
 * This is a temporary component used for debugging metrics data on performance pages.
 * Visible only to small amount of internal users.
 */
function MetricsSwitch() {
  const organization = useOrganization();
  const {isMetricsData, setIsMetricsData} = useMetricsSwitch();

  return (
    <Feature features={[FEATURE_FLAG]} organization={organization}>
      <Label>
        {t('Metrics Data')}
        <Switch
          isActive={isMetricsData}
          toggle={() => setIsMetricsData(!isMetricsData)}
          size="lg"
        />
      </Label>
    </Feature>
  );
}

const Label = styled('label')`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0;
  gap: ${space(1)};
  font-weight: normal;
`;

const MetricsSwitchContext = createContext({
  isMetricsData: false,
  setIsMetricsData: (_isMetricsData: boolean) => {},
});

function MetricsSwitchContextContainer({children}: {children: ReactNode}) {
  const organization = useOrganization();
  const localStorageKey = `metrics-performance:${organization.slug}`;
  const [isMetricsData, setIsMetricsData] = useState(
    localStorage.getItem(localStorageKey) === 'true'
  );

  function handleSetIsMetricsData(value: boolean) {
    localStorage.setItem(localStorageKey, value.toString());
    setIsMetricsData(value);
  }

  return (
    <MetricsSwitchContext.Provider
      value={{
        isMetricsData: isMetricsData && organization.features.includes(FEATURE_FLAG),
        setIsMetricsData: handleSetIsMetricsData,
      }}
    >
      {children}
    </MetricsSwitchContext.Provider>
  );
}

function useMetricsSwitch() {
  const contextValue = useContext(MetricsSwitchContext);

  return contextValue;
}

export {MetricsSwitch, MetricsSwitchContextContainer, useMetricsSwitch};
