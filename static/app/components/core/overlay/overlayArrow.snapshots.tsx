import styled from '@emotion/styled';
import type {Placement} from '@floating-ui/react-dom';

import {Container} from '@sentry/scraps/layout';
import {Overlay, overlayFocusRing} from '@sentry/scraps/overlay';
import {Text} from '@sentry/scraps/text';

const placements: Placement[] = ['top', 'bottom', 'left', 'right'];

interface ExampleOverlayProps {
  placement: Placement;
  hasFocusRing?: boolean;
  size?: number;
}

function ExampleOverlay({placement, size, hasFocusRing}: ExampleOverlayProps) {
  const Wrapper = hasFocusRing ? FocusRingContainer : Container;
  return (
    <Wrapper padding="2xl">
      <Overlay placement={placement} arrowProps={{placement, size}}>
        <Container padding="md lg">
          <Text>An overlay placed {placement}</Text>
        </Container>
      </Overlay>
    </Wrapper>
  );
}

// Snapshots can't take keyboard focus, so the ring is applied unconditionally.
const FocusRingContainer = styled(Container)`
  ${overlayFocusRing}
`;

describe('OverlayArrow', () => {
  it.snapshot.each(placements)(
    '%s',
    placement => <ExampleOverlay placement={placement} />,
    placement => ({tags: {area: 'core', placement}})
  );

  it.snapshot.each(placements)(
    '%s size 20',
    placement => <ExampleOverlay placement={placement} size={20} />,
    placement => ({tags: {area: 'core', placement}})
  );

  it.snapshot.each(placements)(
    '%s with focus ring',
    placement => <ExampleOverlay placement={placement} hasFocusRing />,
    placement => ({tags: {area: 'core', placement}})
  );
});
