import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

interface RevealOnHoverRenderProps {
  className: string;
}

type RevealOnHoverProps =
  | (FlexProps & {children: React.ReactNode})
  | {children: (props: RevealOnHoverRenderProps) => React.ReactNode};

function RevealOnHoverRoot(props: RevealOnHoverProps) {
  const {children, ...rest} = props;

  if (typeof children === 'function') {
    return (
      <RevealOnHoverStyles>{({className}) => children({className})}</RevealOnHoverStyles>
    );
  }

  return (
    <RevealOnHoverFlex align="center" gap="xs" {...rest}>
      {children}
    </RevealOnHoverFlex>
  );
}

const revealStyles = (p: {theme: any}) => `
  @media (hover: hover) {
    [data-reveal-on-hover] {
      opacity: 0;
      visibility: hidden;
      transition:
        opacity ${p.theme.motion.exit.fast},
        visibility ${p.theme.motion.exit.fast};
    }

    &:hover [data-reveal-on-hover],
    &:focus-within [data-reveal-on-hover] {
      opacity: 1;
      visibility: visible;
      transition:
        opacity ${p.theme.motion.enter.moderate},
        visibility ${p.theme.motion.enter.moderate};
    }
  }
`;

const RevealOnHoverFlex = styled(Flex)`
  ${revealStyles}
`;

const RevealOnHoverStyles = styled(
  (props: {
    children: (renderProps: RevealOnHoverRenderProps) => React.ReactNode;
    className?: string;
  }) => {
    return props.children({className: props.className ?? ''});
  }
)`
  ${revealStyles}
`;

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
