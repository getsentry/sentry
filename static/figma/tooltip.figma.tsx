import figma from '@figma/code-connect';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {figmaNodeUrl} from './utils';

figma.connect(Tooltip, figmaNodeUrl('6775-627'), {
  props: {
    // Figma has 'width' (Inherit/Fixed) and 'caretDirection' (Down/Up/Left/Right)
    // but these map to internal positioning logic, not direct React props
    // Tooltip positioning is controlled by 'position' prop
    position: figma.enum('Caret Direction', {
      Down: 'top',
      Up: 'bottom',
      Left: 'right',
      Right: 'left',
    }),
    // maxWidth could map to 'width' but Figma uses Inherit/Fixed
    // React uses numeric pixel value (e.g., 225)
    // No matching props could be found for these Figma properties:
    // width: Figma uses Inherit/Fixed, React uses maxWidth number (default 225px)
    // Core Tooltip props not in Figma:
    // title: React.ReactNode (tooltip content) - REQUIRED
    // children: React.ReactNode (trigger element)
    // disabled: boolean (disable tooltip)
    // overlayStyle: CSSProperties (custom styles)
    // Advanced positioning props:
    // offset, isOpen, onClose, isDismissable, shouldCloseOnBlur
    // shouldCloseOnInteractOutside, preventOverflowOptions, etc.
  } satisfies Partial<TooltipProps>,
  example: props => (
    <Tooltip title="Tooltip content" position={props.position}>
      Hover me
    </Tooltip>
  ),
  links: [
    {
      name: 'Storybook',
      url: 'https://sentry.sentry.io/stories/core/tooltip',
    },
  ],
});
