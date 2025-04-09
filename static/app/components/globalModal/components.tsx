import styled from '@emotion/styled';

import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';

const ModalHeader = styled('header')`
  position: relative;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(3)} ${space(3)};
  margin: -${space(4)} -${space(2)} ${space(3)} -${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
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
    font-weight: ${p => p.theme.fontWeightBold};
    margin-bottom: 0;
    line-height: 1.1;
  }
`;

const ChonkCloseButton = chonkStyled((p: Omit<ButtonProps, 'aria-label'>) => {
  return (
    <Button
      aria-label={t('Close Modal')}
      size="xs"
      icon={<IconClose size="xs" />}
      borderless
      {...p}
    />
  );
})`
  transform: translate(50%, -50%);
  border-radius: 50%;
  position: absolute;
  top: 0;
  right: 0;
  background-color: ${p => p.theme.button.default.background};
  border: 1px solid ${p => p.theme.button.default.border};

  &:hover {
    background-color: ${p => p.theme.button.default.background};
  }
`;

const CloseButton = withChonk(
  styled((p: Omit<ButtonProps, 'aria-label'>) => {
    return (
      <Button
        aria-label={t('Close Modal')}
        icon={<IconClose size="xs" />}
        size={'zero'}
        {...p}
      />
    );
  })`
    position: absolute;
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    border-radius: 50%;
    height: 24px;
    width: 24px;
  `,
  ChonkCloseButton
);

const ModalBody = styled('section')`
  font-size: ${p => p.theme.fontSizeMedium};

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
  padding: ${space(3)} ${space(2)};
  margin: ${space(3)} -${space(3)} -${space(4)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
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
