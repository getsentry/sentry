import {type DO_NOT_USE_ChonkTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {chonkFor, debossedBackground} from 'sentry/components/core/chonk';
import {
  Container,
  type ContainerElement,
  type ContainerProps,
} from 'sentry/components/core/layout/container';
import {rc, type Responsive} from 'sentry/components/core/layout/styles';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

const slabElevation = {
  md: '2px',
  sm: '2px',
  xs: '1px',
} as const;

const slabHoverElevation = '1px';
interface SlabLayoutProps {
  size?: NonNullable<Responsive<'sm' | 'md' | 'xs'>>;
  variant?: 'accent' | 'warning' | 'danger';
}

type SlabProps<T extends ContainerElement = 'div'> = ContainerProps<T> & SlabLayoutProps;

export function Slab<T extends ContainerElement = 'div'>(props: SlabProps<T>) {
  const {variant, border, radius = 'md', size = 'md', ...rest} = props;

  return (
    <SlabContainer size={size} variant={variant} radius={radius}>
      <Container
        border={variant ?? 'primary'}
        radius={radius}
        background="primary"
        {...rest}
      />
    </SlabContainer>
  );
}

function getSlabContainerTheme(
  variant: SlabLayoutProps['variant'],
  theme: DO_NOT_USE_ChonkTheme
) {
  switch (variant) {
    case 'accent':
      return {
        surface: theme.colors.blue400,
        background: chonkFor(theme, theme.colors.blue400),
      };
    case 'warning':
      return {
        surface: theme.colors.chonk.yellow400,
        background: chonkFor(theme, theme.colors.chonk.yellow400),
      };
    case 'danger':
      return {
        surface: theme.colors.chonk.red400,
        background: chonkFor(theme, theme.colors.chonk.red400),
      };
    default:
      return {
        surface: theme.colors.surface500,
        background: theme.colors.surface100,
      };
  }
}

const SlabContainer = styled(Container)<{
  size: SlabLayoutProps['size'];
  variant: SlabLayoutProps['variant'];
}>`
  background-color: ${p =>
    isChonkTheme(p.theme)
      ? getSlabContainerTheme(p.variant, p.theme).background
      : p.theme.tokens.background.primary};

  display: ${p => (isChonkTheme(p.theme) ? undefined : 'contents')};

  > * {
    ${p =>
      rc(
        'transform',
        p.size,
        p.theme,
        (value, _breakpoint, _theme) => `translateY(-${slabElevation[value]})`
      )};
    transition: transform ${p => p.theme.motion.snap.fast};
  }

  &:hover {
    > * {
      ${p =>
        rc(
          'transform',
          p.size,
          p.theme,
          (value, _breakpoint, _theme) =>
            `translateY(calc(-${slabElevation[value]} - ${slabHoverElevation}))`
        )};
    }
  }

  &:active {
    > * {
      transform: translateY(0);
    }
  }

  &:has(> *[aria-disabled='true']),
  &[aria-disabled='true'] {
    > * {
      transform: translateY(0);
    }
  }
`;

interface WellLayoutProps {}
type WellProps<T extends ContainerElement = 'div'> = ContainerProps<T> & WellLayoutProps;

export const Well = styled(<T extends ContainerElement = 'div'>(props: WellProps<T>) => {
  const {radius = 'md', ...rest} = props;

  return <Container border="primary" radius={radius} background="primary" {...rest} />;
})`
  ${p => {
    if (isChonkTheme(p.theme)) {
      return {
        boxShadow: `0px 2px 0px 0px ${p.theme.tokens.border.primary} inset`,
        ...debossedBackground(p.theme),
      };
    }
    return {
      backgroundColor: p.theme.tokens.background.primary,
    };
  }}
`;

interface FloatingSheetLayoutProps {
  size?: Responsive<'sm' | 'md' | 'xs'>;
}
type FloatingSheetProps<T extends ContainerElement = 'div'> = ContainerProps<T> &
  FloatingSheetLayoutProps;

export const FloatingSheet = styled(
  <T extends ContainerElement = 'div'>(props: FloatingSheetProps<T>) => {
    const {
      size = 'md',
      radius = 'md',
      background = 'primary',
      border = 'primary',
      ...rest
    } = props;

    return (
      <FloatingSheetContainer size={size} radius={radius}>
        <Container
          background={background}
          border={border}
          radius={radius}
          position="relative"
          {...rest}
        />
      </FloatingSheetContainer>
    );
  }
)<FloatingSheetProps>``;

const floatingSheetElevation = {
  md: '6px',
  sm: '5px',
  xs: '4px',
} as const;

const FloatingSheetContainer = styled(Container)<{
  size: FloatingSheetLayoutProps['size'];
}>`
  position: relative;
  ${p =>
    rc(
      'transform',
      p.size,
      p.theme,
      (value, _breakpoint, _theme) => `translateY(-${floatingSheetElevation[value]})`
    )}

  > * {
    position: relative;
    z-index: 1;
  }

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: ${p => p.theme.borderRadius};
    right: ${p => p.theme.borderRadius};
    bottom: 0;
    background-color: ${p =>
      isChonkTheme(p.theme)
        ? p.theme.colors.surface100
        : p.theme.tokens.background.secondary};
    border-radius: ${p =>
      isChonkTheme(p.theme) ? p.theme.radius.md : p.theme.borderRadius};
    z-index: 0;
    ${p =>
      rc(
        'transform',
        p.size,
        p.theme,
        (value, _breakpoint, _theme) => `translateY(${floatingSheetElevation[value]})`
      )};
  }
`;
