import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import useOverlay, {type UseOverlayProps} from 'sentry/utils/useOverlay';
import {useNavigation} from 'sentry/views/navigation/navigationContext';

type PrimaryButtonOverlayProps = {
  children: React.ReactNode;
  overlayProps: React.HTMLAttributes<HTMLDivElement>;
};

export function usePrimaryButtonOverlay(props: UseOverlayProps = {}) {
  const {layout} = useNavigation();

  return useOverlay({
    offset: 8,
    position: layout === 'mobile' ? 'bottom' : 'right-end',
    isDismissable: true,
    shouldApplyMinWidth: false,
    ...props,
  });
}

/**
 * Overlay to be used for primary navigation buttons in footer, such as
 * "what's new" and "onboarding". This will appear as a normal overlay
 * on desktop and a modified overlay in mobile to match the design of
 * the mobile topbar.
 */
export function PrimaryButtonOverlay({
  children,
  overlayProps,
}: PrimaryButtonOverlayProps) {
  const theme = useTheme();
  const {layout} = useNavigation();

  return createPortal(
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper zIndex={theme.zIndex.modal} {...overlayProps}>
        <ScrollableOverlay isMobile={layout === 'mobile'}>{children}</ScrollableOverlay>
      </PositionWrapper>
    </FocusScope>,
    document.body
  );
}

const ScrollableOverlay = styled(Overlay, {
  shouldForwardProp: prop => prop !== 'isMobile',
})<{
  isMobile: boolean;
}>`
  overscroll-behavior: none;
  min-height: 150px;
  max-height: ${p => (p.isMobile ? '80vh' : '60vh')};
  overflow-y: auto;
  width: ${p => (p.isMobile ? `calc(100vw - ${p.theme.space['3xl']})` : '400px')};
`;
