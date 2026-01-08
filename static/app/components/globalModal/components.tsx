import styled from '@emotion/styled';

import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const ModalHeader = styled('header')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
  position: relative;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${space(3)} ${space(3)};
  margin: -${space(4)} -${space(2)} ${space(3)} -${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(3)} ${space(4)};
    margin: -${space(4)} -${space(4)} ${space(3)} -${space(4)};
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: 20px;
    font-weight: ${p => p.theme.fontWeight.bold};
    margin-bottom: 0;
    line-height: 1.1;
  }
`;

function CloseButton(p: Omit<ButtonProps, 'aria-label'>) {
  return (
    <Button
      aria-label={t('Close Modal')}
      size="xs"
      icon={<IconClose size="xs" />}
      borderless
      {...p}
    />
  );
}

const ModalBody = styled('section')`
  font-size: ${p => p.theme.fontSize.md};

  p:last-child {
    margin-bottom: 0;
  }

  img {
    max-width: 100%;
  }
`;

const ModalFooter = styled('footer')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  display: flex;
  justify-content: flex-end;
  padding: ${space(3)} ${space(2)};
  margin: ${space(3)} -${space(3)} -${space(4)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(3)} ${space(4)};
    margin: ${space(3)} -${space(4)} -${space(4)};
  }
`;

interface ClosableHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Show a close button in the header
   */
  closeButton?: boolean;
}
/**
 * Creates a ModalHeader that includes props to enable the close button
 */
const makeClosableHeader = (closeModal: () => void) => {
  function ClosableHeader({closeButton, children, ...props}: ClosableHeaderProps) {
    return (
      <ModalHeader {...props}>
        {children}
        {closeButton ? <CloseButton onClick={closeModal} /> : null}
      </ModalHeader>
    );
  }

  return ClosableHeader;
};

/**
 * Creates a CloseButton component that is connected to the provided closeModal trigger
 */
const makeCloseButton = (closeModal: () => void) =>
  function (props: Omit<ButtonProps, 'aria-label'>) {
    return <CloseButton onClick={closeModal} {...props} />;
  };

export {makeClosableHeader, makeCloseButton, ModalBody, ModalFooter};
