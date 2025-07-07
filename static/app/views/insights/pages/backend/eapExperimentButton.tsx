import type {Key} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {USE_NEW_BACKEND_EXPERIENCE} from 'sentry/views/insights/pages/backend/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export function EAPExperimentButton() {
  const organization = useOrganization();
  const {view} = useDomainViewFilters();
  const location = useLocation();
  const isEapFlagEnabled = organization.features.includes('insights-modules-use-eap');
  const isNewBackendExperienceEnabled = useInsightsEap(); // useEap accounts for the local storage state
  const [_, setNewBackendExperienceEnabled] = useLocalStorageState(
    USE_NEW_BACKEND_EXPERIENCE,
    true
  );
  const navigate = useNavigate();

  const toggleUseEap = () => {
    const newState = !isNewBackendExperienceEnabled;
    setNewBackendExperienceEnabled(newState);
    trackAnalytics('insights.eap.toggle', {
      organization,
      isEapEnabled: newState,
      page: 'overview',
      view,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        useEap: newState ? '1' : '0',
      },
    });
  };

  const handleExperimentDropdownAction = (key: Key) => {
    if (key === 'eap') {
      toggleUseEap();
    }
  };

  if (!isEapFlagEnabled) {
    return null;
  }

  return (
    <StyledDropdownMenu
      trigger={triggerProps => (
        <StyledDropdownButton {...triggerProps} size={'sm'}>
          {/* Passing icon as child to avoid extra icon margin */}
          <IconLab isSolid />
        </StyledDropdownButton>
      )}
      onAction={handleExperimentDropdownAction}
      items={[
        {
          key: 'eap',
          label: isNewBackendExperienceEnabled ? 'Switch to Old UI' : 'Switch to New UI',
        },
      ]}
      position="bottom-end"
    />
  );
}

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.button.primary.background};
  :hover {
    color: ${p => p.theme.button.primary.background};
  }
`;

const StyledDropdownMenu = styled(DropdownMenu)`
  display: none;
`;
