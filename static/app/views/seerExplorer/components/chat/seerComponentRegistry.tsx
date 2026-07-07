import type {ReactNode} from 'react';

/**
 * The generic props every Seer embed receives, mirroring the markdown `Tag`
 * renderer. Each embed adapts these into its component's real props.
 */
export interface SeerEmbedProps {
  attrs: Record<string, string>;
  data: unknown;
  level: 'block' | 'inline';
  name: string;
}

export type SeerEmbedComponent = (props: SeerEmbedProps) => ReactNode;

export interface RegisteredSeerEmbed {
  component: SeerEmbedComponent;
  name: string;
  /** Sample props used to preview the embed in docs/stories. */
  example?: SeerEmbedProps;
}

const registry = new Map<string, RegisteredSeerEmbed>();

/**
 * Registry mapping a markdown tag name (e.g. `docs-link`) to the embed that
 * renders it. Components register themselves at module load; the markdown `Tag`
 * renderer looks them up by name. See `seerComponents.tsx` for the import that
 * pulls every embed in so its registration runs.
 */
export const SeerComponentRegistry = {
  register(
    name: string,
    component: SeerEmbedComponent,
    example?: Omit<SeerEmbedProps, 'name'>
  ): void {
    registry.set(name, {
      name,
      component,
      example: example && {name, ...example},
    });
  },
  get(name: string): SeerEmbedComponent | undefined {
    return registry.get(name)?.component;
  },
  list(): RegisteredSeerEmbed[] {
    return [...registry.values()];
  },
};
