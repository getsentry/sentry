import type {ReactNode} from 'react';

/**
 * Generic props every Seer embed receives from the markdown Tag renderer.
 * Each embed adapter maps these into its component's real props.
 */
export interface SeerEmbedProps {
  data: unknown;
  level: 'block' | 'inline';
  name: string;
}

export type SeerEmbedComponent = (props: SeerEmbedProps) => ReactNode;

interface RegisteredEmbed {
  component: SeerEmbedComponent;
  name: string;
  example?: SeerEmbedProps;
}

const registry = new Map<string, RegisteredEmbed>();

export const SeerEmbedRegistry = {
  register(
    name: string,
    component: SeerEmbedComponent,
    example?: Omit<SeerEmbedProps, 'name'>
  ): void {
    registry.set(name, {
      name,
      component,
      example: example ? {name, ...example} : undefined,
    });
  },

  get(name: string): SeerEmbedComponent | undefined {
    return registry.get(name)?.component;
  },

  list(): RegisteredEmbed[] {
    return [...registry.values()];
  },
};
