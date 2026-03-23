import styled from '@emotion/styled';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';

const ModalHeader = styled('header')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${p => p.theme.space.md};
  position: relative;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['2xl']};
  margin: -${p => p.theme.space['3xl']} -${p => p.theme.space.xl}
    ${p => p.theme.space['2xl']} -${p => p.theme.space['2xl']};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']};
    margin: -${p => p.theme.space['3xl']} -${p => p.theme.space['3xl']}
      ${p => p.theme.space['2xl']} -${p => p.theme.space['3xl']};
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: 20px;
    font-weight: ${p => p.theme.font.weight.sans.medium};
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
      priority="transparent"
      {...p}
    />
  );
}

const ModalBody = styled('section')`
  font-size: ${p => p.theme.font.size.md};

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
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space.xl};
  margin: ${p => p.theme.space['2xl']} -${p => p.theme.space['2xl']} -${p =>
      p.theme.space['3xl']};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']};
    margin: ${p => p.theme.space['2xl']} -${p => p.theme.space['3xl']} -${p =>
        p.theme.space['3xl']};
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
