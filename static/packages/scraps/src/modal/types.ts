import type * as React from 'react';
import type {ComponentProps} from 'react';
import type {Interpolation, Theme} from '@emotion/react';

import type {Backdrop} from '@sentry/scraps/backdrop';

import type {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from './components';

export type ModalOptions = {
  /**
   * Set to `false` to disable the backdrop from being rendered.
   * Set to `true` (the default) to show a translucent backdrop.
   * Set to `{}` to pass props to the Backdrop component.
   */
  backdrop?: boolean | ComponentProps<typeof Backdrop>;
  /**
   * By default, the modal is closed when the backdrop is clicked or the
   * escape key is pressed. This prop allows you to modify that behavior.
   * Only use when completely necessary, the defaults are important for
   * accessibility.
   *
   * 'all' (default) - the modal is automatically closed on backdrop click or
   *   escape key.
   * 'none' - the modal cannot be dismissed with either the mouse or the
   *   keyboard. The modal will need to be closed manually with `closeModal()`.
   *   This should only be used when a modal requires user input and cannot be
   *   dismissed, which is rare.
   * 'backdrop-click' - the modal cannot be dimissed by pressing the escape key.
   * 'escape-key' - the modal cannot be dismissed by clicking on the backdrop.
   *   This is useful for modals containing user input which will disappear on an
   *   accidental click.
   */
  closeEvents?: 'all' | 'none' | 'backdrop-click' | 'escape-key';
  /**
   * Additional CSS which will be applied to the modals `role="dialog"`
   * component. You may use the `[role="document"]` selector to target the
   * actual modal content to style the visual element of the modal.
   */
  modalCss?: Interpolation<Theme>;
  /**
   * Callback for when the modal is closed
   */
  onClose?: (reason?: 'close-button' | 'backdrop-click' | 'escape-key') => void;
};

export type ModalRenderProps = {
  /**
   * Body container for the modal
   */
  Body: typeof ModalBody;
  /**
   * Looks like a close button. Useful for when you don't want to render the
   * header which can include the close button.
   */
  CloseButton: ReturnType<typeof makeCloseButton>;
  /**
   * Footer container for the modal, typically for actions
   */
  Footer: typeof ModalFooter;
  /**
   * The modal header, optionally includes a close button which will close the
   * modal.
   */
  Header: ReturnType<typeof makeClosableHeader>;
  /**
   * Closes the modal
   */
  closeModal: () => void;
  /**
   * Reference to the modal's container.
   */
  modalContainerRef?: React.RefObject<HTMLDivElement | null>;
};

export type ModalRenderer = (renderProps: ModalRenderProps) => React.ReactNode;

export interface ModalBoundaryProps extends React.PropsWithChildren {
  header: React.ReactNode;
  onDismiss: () => void;
  resetKey: number;
}
