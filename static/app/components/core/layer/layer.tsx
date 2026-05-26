import {createContext, Fragment, useContext, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {HoverOverlayGroupProvider} from 'sentry/utils/useHoverOverlay';

type LayerVariant = 'content' | 'nav' | 'overlay';

interface LayerContextValue {
  depth: number;
  portalOutlet: HTMLElement | null;
  variant: LayerVariant | null;
}

const LayerContext = createContext<LayerContextValue>({
  variant: null,
  depth: 0,
  portalOutlet: null,
});

interface LayerProps {
  children: React.ReactNode | ((props: {className: string}) => React.ReactNode);
  variant: LayerVariant;
}

export const Layer = styled(
  ({variant, children, ...props}: LayerProps & {className?: string}) => {
    const parentContext = useContext(LayerContext);
    const [portalOutlet, setPortalOutlet] = useState<HTMLElement | null>(null);

    const depth = parentContext.variant === variant ? parentContext.depth + 1 : 0;

    const contextValue = useMemo<LayerContextValue>(
      () => ({variant, depth, portalOutlet}),
      [variant, depth, portalOutlet]
    );

    const className = props.className ?? '';

    if (typeof children === 'function') {
      return (
        <LayerContext value={contextValue}>
          <HoverOverlayGroupProvider>
            <Fragment>
              {children({className})}
              <PortalOutlet ref={setPortalOutlet} />
            </Fragment>
          </HoverOverlayGroupProvider>
        </LayerContext>
      );
    }

    return (
      <LayerContext value={contextValue}>
        <HoverOverlayGroupProvider>
          <div className={className}>
            {children}
            <PortalOutlet ref={setPortalOutlet} />
          </div>
        </HoverOverlayGroupProvider>
      </LayerContext>
    );
  }
)<LayerProps>`
  isolation: isolate;
`;

export function useLayerContext(): LayerContextValue {
  return useContext(LayerContext);
}

export function usePortalContainer(): HTMLElement | null {
  return useLayerContext().portalOutlet;
}

const PortalOutlet = styled('div')`
  position: fixed;
  pointer-events: none;
  width: 0;
  height: 0;
  overflow: visible;
`;
