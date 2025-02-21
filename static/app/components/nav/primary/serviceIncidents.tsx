import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useNavContext} from 'sentry/components/nav/context';
import {
  NavButton,
  SidebarItem,
  SidebarItemUnreadIndicator,
} from 'sentry/components/nav/primary/components';
import {NavLayout} from 'sentry/components/nav/types';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {ServiceIncidentDetails} from 'sentry/components/serviceIncidentDetails';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {StatuspageIncident} from 'sentry/types/system';
import useOverlay from 'sentry/utils/useOverlay';
import {useServiceIncidents} from 'sentry/utils/useServiceIncidents';

function ServiceIncidentsButton({incidents}: {incidents: StatuspageIncident[]}) {
  const {layout} = useNavContext();
  const showLabel = layout === NavLayout.MOBILE;
  const theme = useTheme();
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = useOverlay({
    offset: 8,
    position: 'right-end',
    isDismissable: true,
  });

  return (
    <SidebarItem>
      <NavButton
        {...overlayTriggerProps}
        isMobile={false}
        aria-label={showLabel ? undefined : t('Service status')}
      >
        <InteractionStateLayer />
        <IconWarning />
        {showLabel ? t('Service status') : null}
        <WarningUnreadIndicator />
      </NavButton>
      {isOpen && (
        <FocusScope autoFocus restoreFocus>
          <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
            <ScrollableOverlay>
              {incidents.map(incident => (
                <IncidentItemWrapper key={incident.id}>
                  <ServiceIncidentDetails incident={incident} />
                </IncidentItemWrapper>
              ))}
            </ScrollableOverlay>
          </PositionWrapper>
        </FocusScope>
      )}
    </SidebarItem>
  );
}
export function PrimaryNavigationServiceIncidents() {
  const {data: incidents = []} = useServiceIncidents();

  if (!incidents || incidents.length === 0) {
    return null;
  }

  return <ServiceIncidentsButton incidents={incidents} />;
}

const IncidentItemWrapper = styled('div')`
  line-height: 1.5;
  background: ${p => p.theme.background};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(3)};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const ScrollableOverlay = styled(Overlay)`
  max-height: 60vh;
  width: 400px;
  overflow-y: auto;
`;

const WarningUnreadIndicator = styled(SidebarItemUnreadIndicator)`
  background: ${p => p.theme.warning};
`;
