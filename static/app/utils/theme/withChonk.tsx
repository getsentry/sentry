import {forwardRef, type PropsWithoutRef} from 'react';
import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {useTheme} from '@emotion/react';

export type ChonkPropMapping<LegacyProps, ChonkProps> = (
  props: Omit<PropsWithoutRef<LegacyProps>, 'theme'>
) => Omit<PropsWithoutRef<ChonkProps>, 'theme'>;

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
    theme?: DO_NOT_USE_ChonkTheme;
  } & React.RefAttributes<any>,
>(
  legacyComponent: React.ComponentType<LegacyProps>,
  chonkComponent: React.ComponentType<ChonkProps>,
  propMapping: ChonkPropMapping<LegacyProps, ChonkProps>
): React.ForwardRefExoticComponent<
  React.PropsWithoutRef<LegacyProps> & React.RefAttributes<any>
> {
  function ChonkSwitch(props: PropsWithoutRef<LegacyProps>, ref: React.Ref<any>) {
    const theme = useTheme();

    if (theme.isChonk) {
      const ChonkComponent: any = chonkComponent;
      return (
        <ChonkComponent
          ref={ref}
          {...propMapping(props)}
          theme={theme as unknown as DO_NOT_USE_ChonkTheme}
        >
          {props.children}
        </ChonkComponent>
      );
    }

    const LegacyComponent: any = legacyComponent;
    return (
      <LegacyComponent ref={ref} {...props}>
        {props.children}
      </LegacyComponent>
    );
  }

  const ForwardRefComponent = forwardRef(ChonkSwitch);
  return ForwardRefComponent;
}
