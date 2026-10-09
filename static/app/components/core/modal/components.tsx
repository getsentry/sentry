import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {IconClose} from 'sentry/icons/iconClose';

function CloseButton(p: Omit<ButtonProps, 'aria-label'>) {
  const {t} = useTranslation();

  return (
    <Button
      aria-label={t('Close Modal')}
      size="xs"
      icon={<IconClose size="xs" />}
      variant="transparent"
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

const ModalFooter = styled((props: React.HTMLAttributes<HTMLElement>) => {
  return (
    <Flex
      {...props}
      as="footer"
      justify="end"
      borderTop="primary"
      padding={{zero: '2xl xl', '3xl': '2xl 3xl'}}
      css={(theme: Theme) => css`
        margin: ${theme.space['2xl']} -${theme.space['2xl']} -${theme.space['3xl']};

        @container (min-width: ${theme.container['3xl']}) {
          margin-right: -${theme.space['3xl']};
          margin-left: -${theme.space['3xl']};
        }
      `}
    />
  );
})``;

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
      <Flex
        {...props}
        as="header"
        css={(theme: Theme) => css`
          margin: -${theme.space['3xl']} -${theme.space.xl}
            ${theme.space['2xl']} -${theme.space['2xl']};

          @container (min-width: ${theme.container['3xl']}) {
            margin-right: -${theme.space['3xl']};
            margin-left: -${theme.space['3xl']};
          }

          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
            font-size: 20px;
            font-weight: ${theme.font.weight.sans.medium};
            margin-bottom: 0;
            line-height: 1.1;
          }
        `}
        justify="between"
        align="center"
        gap="md"
        position="relative"
        borderBottom="primary"
        padding={{zero: '2xl', '3xl': '2xl 3xl'}}
      >
        {children}
        {closeButton ? <CloseButton onClick={closeModal} /> : null}
      </Flex>
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
