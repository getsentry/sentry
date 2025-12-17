import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';

export interface TreemapControlButton {
  ariaLabel: string;
  disabled: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}

interface TreemapControlButtonsProps {
  buttons: TreemapControlButton[];
}

export function TreemapControlButtons({buttons}: TreemapControlButtonsProps) {
  return (
    <Flex
      position="absolute"
      top="0"
      right="0"
      height="20px"
      gap="xs"
      align="center"
      direction="row"
      onMouseDown={e => e.stopPropagation()}
    >
      {buttons.map(button => (
        <TreemapControlButton
          key={button.onClick.toString()}
          size="xs"
          aria-label={button.ariaLabel}
          title={button.title}
          borderless
          icon={button.icon}
          onClick={button.onClick}
          disabled={button.disabled}
        />
      ))}
    </Flex>
  );
}

const TreemapControlButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.white};
  height: 22px;
  min-height: 20px;
  max-height: 20px;
  padding: 0 ${p => p.theme.space.xs};
  background: rgba(0, 0, 0, 0.8);
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowMedium};

  &:hover {
    color: ${p => p.theme.white};
    background: rgba(0, 0, 0, 0.9);
  }
`;
