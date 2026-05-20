import {css, useTheme} from '@emotion/react';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

interface RevealOnHoverProps extends FlexProps {
  children: React.ReactNode;
}

function RevealOnHoverRoot({children, ...props}: RevealOnHoverProps) {
  const theme = useTheme();

  return (
    <Flex
      align="center"
      gap="xs"
      css={css`
        @media (hover: hover) {
          [data-reveal-on-hover] {
            opacity: 0;
            visibility: hidden;
            transition:
              opacity ${theme.motion.exit.fast},
              visibility ${theme.motion.exit.fast};
          }

          &:hover [data-reveal-on-hover],
          &:focus-within [data-reveal-on-hover] {
            opacity: 1;
            visibility: visible;
            transition:
              opacity ${theme.motion.enter.moderate},
              visibility ${theme.motion.enter.moderate};
          }
        }
      `}
      {...props}
    >
      {children}
    </Flex>
  );
}

interface ActionProps {
  children: React.ReactNode;
  alwaysVisible?: boolean;
}

function Action({children, alwaysVisible}: ActionProps) {
  if (alwaysVisible) {
    return children;
  }

  return <span data-reveal-on-hover="">{children}</span>;
}

export const RevealOnHover = Object.assign(RevealOnHoverRoot, {
  Action,
});
