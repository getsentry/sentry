import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {useTheme} from '@emotion/react';

export type ChonkPropMapping<LegacyProps, ChonkProps> = (
  props: Omit<LegacyProps, 'theme'>
) => Omit<ChonkProps, 'theme'>;

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
  LegacyProps extends {children?: React.ReactNode},
  ChonkProps extends {theme: DO_NOT_USE_ChonkTheme; children?: React.ReactNode},
>(
  legacyComponent: React.ComponentType<LegacyProps>,
  chonkComponent: React.ComponentType<ChonkProps>,
  propMapping: ChonkPropMapping<LegacyProps, ChonkProps>
): (props: LegacyProps, theme: DO_NOT_USE_ChonkTheme) => React.ReactNode {
  return function (props: LegacyProps) {
    const theme = useTheme();

    if (theme.isChonk) {
      const ChonkComponent: any = chonkComponent;
      return (
        <ChonkComponent
          {...propMapping(props)}
          theme={theme as unknown as DO_NOT_USE_ChonkTheme}
        >
          {props.children}
        </ChonkComponent>
      );
    }

    const LegacyComponent: any = legacyComponent;
    return <LegacyComponent {...props}>{props.children}</LegacyComponent>;
  };
}
