import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';
import type {ContainerElement} from '@sentry/scraps/layout/container';

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

const revealStyles = (p: {theme: import('@emotion/react').Theme}) => `
  @media (hover: hover) {
    [data-reveal-on-hover] {
      opacity: 0;
      pointer-events: none;
      transition: opacity ${p.theme.motion.exit.fast};
    }

    &:hover [data-reveal-on-hover],
    &:focus-within [data-reveal-on-hover] {
      opacity: 1;
      pointer-events: auto;
      transition: opacity ${p.theme.motion.enter.moderate};
    }
  }
`;

function RevealOnHoverFlex<T extends ContainerElement>(props: FlexProps<T>) {
  return <Flex css={theme => revealStyles({theme})} {...props} />;
}

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
  visible?: boolean;
}

function Action({children, visible}: ActionProps) {
  if (visible) {
    return children;
  }

  return <span data-reveal-on-hover="">{children}</span>;
}

export const RevealOnHover = Object.assign(RevealOnHoverRoot, {
  Action,
});
