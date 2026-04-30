import {createContext, useContext, useMemo, useState} from 'react';
import styled from '@emotion/styled';

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
  children: React.ReactNode;
  variant: LayerVariant;
}

export function Layer({variant, children}: LayerProps) {
  const parentContext = useContext(LayerContext);
  const [portalOutlet, setPortalOutlet] = useState<HTMLElement | null>(null);

  const depth = parentContext.variant === variant ? parentContext.depth + 1 : 0;

  const contextValue = useMemo<LayerContextValue>(
    () => ({variant, depth, portalOutlet}),
    [variant, depth, portalOutlet]
  );

  return (
    <LayerContext value={contextValue}>
      <StyledLayer>
        {children}
        <PortalOutlet ref={setPortalOutlet} />
      </StyledLayer>
    </LayerContext>
  );
}

export function useLayerContext(): LayerContextValue {
  return useContext(LayerContext);
}

export function usePortalContainer(): HTMLElement | null {
  const {portalOutlet} = useContext(LayerContext);
  return portalOutlet;
}

const StyledLayer = styled('div')`
  isolation: isolate;
  position: relative;
`;

const PortalOutlet = styled('div')`
  position: fixed;
  inset: 0;
  pointer-events: none;
`;
