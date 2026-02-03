import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {IconCheckmark, IconClose} from 'sentry/icons';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onClick'> {
  ref?: React.Ref<HTMLInputElement>;
  size?: 'sm' | 'lg';
}

const toggleWrapperSize = {
  sm: {width: 36, height: 20},
  lg: {width: 40, height: 24},
};

const toggleButtonSize = {
  sm: {width: 20, height: 20},
  lg: {width: 24, height: 24},
};

const NativeHiddenCheckbox = styled('input')<{
  nativeSize: NonNullable<SwitchProps['size']>;
}>`
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;

  &:focus-visible + div {
    ${p => p.theme.focusRing()};
  }

  + div {
    background: ${p => p.theme.tokens.interactive.chonky.debossed.neutral.background};
    border-top: 3px solid ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk};
    border-right: 1px solid
      ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk};
    border-bottom: 1px solid
      ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk};
    border-left: 1px solid
      ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk};

    transition: all ${p => p.theme.motion.spring.moderate};

    [data-icon='checkmark'],
    [data-icon='close'] {
      top: 50%;
      left: 50%;
      position: absolute;
      transform: scale(0.94) translate(-50%, -50%);
      transform-origin: center center;
      transition: all ${p => p.theme.motion.spring.fast};
    }

    > div {
      background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
      border: 1px solid ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
      transition: transform ${p => p.theme.motion.spring.moderate};
      transform: translateY(-1px) translateX(-1px);
    }
  }

  & + div {
    [data-icon='close'] {
      opacity: 1;
      transform: scale(1) translate(-50%, -50%);
    }

    [data-icon='checkmark'] {
      opacity: 0;
      transform: scale(0.94) translate(-50%, -50%);
    }
  }

  &:checked + div {
    [data-icon='close'] {
      opacity: 0;
      transform: scale(0.94) translate(-50%, -50%);
    }

    [data-icon='checkmark'] {
      opacity: 1;
      transform: scale(1) translate(-50%, -50%);
    }

    background: ${p => p.theme.tokens.interactive.chonky.debossed.accent.background};

    border-top: 3px solid ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};
    border-right: 1px solid
      ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};
    border-bottom: 1px solid
      ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};
    border-left: 1px solid ${p => p.theme.tokens.interactive.chonky.debossed.accent.chonk};

    > div {
      background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
      border: 1px solid ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
      transform: translateY(-1px) translateX(-1px)
        translateX(
          ${p =>
            toggleWrapperSize[p.nativeSize].width -
            toggleButtonSize[p.nativeSize].width +
            1}px
        );
    }
  }

  &:disabled {
    cursor: not-allowed;
    + div {
      opacity: ${p => p.theme.tokens.interactive.disabled};

      > div {
        transform: translateY(0px) translateX(-1px);
      }
    }
  }

  &:checked:disabled + div > div {
    transform: translateY(0px)
      translateX(
        ${p =>
          toggleWrapperSize[p.nativeSize].width -
          toggleButtonSize[p.nativeSize].width +
          1}px
      );
  }
`;

export function Switch({ref, size = 'sm', ...props}: SwitchProps) {
  return (
    <Flex display="inline-flex" justify="start" position="relative">
      {/* @TODO(jonasbadalic): if we name the prop size, it conflicts with the native input size prop,
       * so we need to use a different name, or somehow tell emotion to not create a type intersection.
       */}
      <NativeHiddenCheckbox ref={ref} type="checkbox" nativeSize={size} {...props} />
      <Container
        width={`${toggleWrapperSize[size].width}px`}
        height={`${toggleWrapperSize[size].height}px`}
        pointerEvents="none"
        radius="sm"
      >
        <Container
          width={`${toggleButtonSize[size].width}px`}
          height={`${toggleButtonSize[size].height}px`}
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          radius="sm"
        >
          <IconClose
            data-icon="close"
            variant="muted"
            size={size === 'sm' ? 'xs' : 'sm'}
          />
          <IconCheckmark
            data-icon="checkmark"
            variant="accent"
            size={size === 'sm' ? 'xs' : 'sm'}
          />
        </Container>
      </Container>
    </Flex>
  );
}
