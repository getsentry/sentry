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

const revealStyles = (p: {theme: import('@emotion/react').Theme}) => `
  [data-reveal-on-hover][data-reveal-on-hover-visible] {
    opacity: 1;
    pointer-events: auto;
  }

  @media (hover: hover) {
    [data-reveal-on-hover] {
      opacity: 0;
      pointer-events: none;
      transition: opacity ${p.theme.motion.exit.fast};
    }

    &:hover [data-reveal-on-hover],
    &:has(:focus-visible) [data-reveal-on-hover] {
      opacity: 1;
      pointer-events: auto;
      transition: opacity ${p.theme.motion.enter.moderate};
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
  visible?: boolean;
}

function Action({children, visible}: ActionProps) {
  return (
    <span data-reveal-on-hover="" data-reveal-on-hover-visible={visible ? '' : undefined}>
      {children}
    </span>
  );
}

export const RevealOnHover = Object.assign(RevealOnHoverRoot, {
  Action,
});
