import type {ReactNode} from 'react';

/**
 * Generic props every Seer embed receives from the markdown Tag renderer.
 * Each embed adapter maps these into its component's real props.
 */
export interface SeerEmbedProps {
  data: unknown;
  level: 'block' | 'inline';
  name: string;
  /**
   * Position among all embeds in the message, in document order. Assigned by
   * `Markdown` while lexing; see `renderTracking` for what it is used for.
   */
  index?: number;
}

export type SeerEmbedComponent = (props: SeerEmbedProps) => ReactNode;

interface RegisteredEmbed {
  component: SeerEmbedComponent;
  name: string;
}

const registry = new Map<string, RegisteredEmbed>();

export const SeerEmbedRegistry = {
  register(name: string, component: SeerEmbedComponent): void {
    registry.set(name, {name, component});
  },

  get(name: string): SeerEmbedComponent | undefined {
    return registry.get(name)?.component;
  },

  list(): RegisteredEmbed[] {
    return [...registry.values()];
  },
};
