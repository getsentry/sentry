import {lazy, Suspense} from 'react';
import styled from '@emotion/styled';

import LoadingMask from 'sentry/components/loadingMask';
import {space} from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  /**
   * An icon may be passed as a string name which will be dynamically with a
   * ContextIcon or a react node will simply render.
   */
  icon?: string | React.ReactElement;
};

const ContextIcon = lazy(() => import('./contextIcon'));

function Item({children, icon = 'unknown'}: Props) {
  // XXX: Codesplit the ContextIcon component since it packs a lot of SVGs
  const iconNode =
    typeof icon === 'string' ? (
      <Suspense fallback={<LoadingMask />}>
        <ContextIcon name={icon} />
      </Suspense>
    ) : (
      icon
    );

  return (
    <ItemContainer data-test-id="context-item">
      <IconContainer>{iconNode}</IconContainer>
      {children && <Details>{children}</Details>}
    </ItemContainer>
  );
}

export default Item;

const Details = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 48px;
  min-width: 0;
`;

const IconContainer = styled('div')`
  width: 36px;
  height: 36px;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
`;

const ItemContainer = styled('div')`
  position: relative;
  display: flex;
  gap: ${space(1)};
  align-items: center;
  max-width: 25%;

  h3 {
    ${p => p.theme.overflowEllipsis}
    font-size: ${p => p.theme.fontSizeLarge};
    margin-bottom: ${space(0.25)};
  }

  p {
    font-size: ${p => p.theme.fontSizeSmall};

    &:last-child {
      margin: 0;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    max-width: initial;
    padding-top: ${space(0.5)};
    padding-bottom: ${space(0.5)};

    :not(:first-child) {
      border-top: 1px solid ${p => p.theme.innerBorder};
    }
  }
`;
