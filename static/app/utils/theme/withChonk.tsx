import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

type ChonkPropMapping<LegacyProps, ChonkProps> = (
  props: Omit<LegacyProps, 'theme' | 'ref'>
) => Omit<ChonkProps, 'theme' | 'ref'>;

/**
 * Higher order utility function that manages the migration layer between chonk and legacy components.
 * It allows us to swap out parts of the component tree with chonk components and highlights the API differences between the two
 * by requiring the prop mapping function to be defined.
 *
 * @param legacyComponent - The legacy component to wrap.
 * @param chonkComponent - The chonk component to wrap the legacy component in.
 * @param propMapping - A function that maps the props of the legacy component to the props of the chonk component.
 * @returns A new component that is a wrapper around the legacy component.
 */
export function withChonk<
  LegacyProps extends {children?: React.ReactNode} & React.RefAttributes<any>,
  ChonkProps extends {
    children?: React.ReactNode;
    theme?: Theme;
  } & React.RefAttributes<any>,
>(
  _legacyComponent: React.ComponentType<LegacyProps>,
  chonkComponent: React.ComponentType<ChonkProps>,
  propMapping: ChonkPropMapping<LegacyProps, ChonkProps> = identity
) {
  function ChonkSwitch(props: LegacyProps) {
    const theme = useTheme();

    const ChonkComponent: any = chonkComponent;
    return (
      <ChonkComponent {...propMapping(props)} ref={props.ref} theme={theme}>
        {props.children}
      </ChonkComponent>
    );
  }

  return styled(ChonkSwitch)``;
}

function identity<T, U>(props: T): U {
  return props as unknown as U;
}
