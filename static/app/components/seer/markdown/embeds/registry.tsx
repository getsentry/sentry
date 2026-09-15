import type {ReactNode} from 'react';

/**
 * How an embed is being asked to render itself.
 *
 * `block` and `inline` are positions in the document, chosen by the markdown
 * lexer. `markdown` is not a position: it is the plain-text pass used when a
 * reply is serialized back out -- copying it to the clipboard -- where React
 * elements are useless. Embeds return a string at that level.
 */
export type SeerEmbedRenderLevel = 'block' | 'inline' | 'markdown';

/**
 * Generic props every Seer embed receives from the markdown Tag renderer.
 * Each embed adapter maps these into its component's real props.
 */
export interface SeerEmbedProps {
  data: unknown;
  level: SeerEmbedRenderLevel;
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
