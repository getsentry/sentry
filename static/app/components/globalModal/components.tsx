import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconClose} from 'app/icons/iconClose';
import {t} from 'app/locale';
import space from 'app/styles/space';

const ModalHeader = styled('header')`
  position: relative;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(3)} ${space(4)};
  margin: -${space(4)} -${space(4)} ${space(3)} -${space(4)};

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 0;
    line-height: 1.1;
  }
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(50%, -50%);
  border-radius: 50%;
  background: ${p => p.theme.background};
  height: 24px;
  width: 24px;
`;

CloseButton.defaultProps = {
  label: t('Close Modal'),
  icon: <IconClose size="10px" />,
  size: 'zero',
};

const ModalBody = styled('section')`
  font-size: 15px;

  p:last-child {
    margin-bottom: 0;
  }

  img {
    max-width: 100%;
  }
`;

const ModalFooter = styled('footer')`
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  justify-content: flex-end;
  padding: ${space(3)} ${space(4)};
  margin: ${space(3)} -${space(4)} -${space(4)};
`;

type HeaderProps = {
  /**
   * Show a close button in the header
   */
  closeButton?: boolean;
};

/**
 * Creates a ModalHeader that includes props to enable the close button
 */
const makeClosableHeader = (closeModal: () => void) => {
  const ClosableHeader: React.FC<React.ComponentProps<typeof ModalHeader> & HeaderProps> =
    ({closeButton, children, ...props}) => (
      <ModalHeader {...props}>
        {children}
        {closeButton && <CloseButton onClick={closeModal} />}
      </ModalHeader>
    );

  ClosableHeader.displayName = 'Header';

  return ClosableHeader;
};

/**
 * Creates a CloseButton component that is connected to the provided closeModal trigger
 */
const makeCloseButton =
  (closeModal: () => void): React.FC<React.ComponentProps<typeof CloseButton>> =>
  props =>
    <CloseButton {...props} onClick={closeModal} />;

export {makeClosableHeader, makeCloseButton, ModalBody, ModalFooter};
