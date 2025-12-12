import {Fragment, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';
import classNames from 'classnames';
import type {DistributedOmit} from 'type-fest';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import PanelProvider from 'sentry/utils/panelProvider';
import {unreachable} from 'sentry/utils/unreachable';

import * as ChonkAlert from './alert.chonk';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'muted' | 'info' | 'warning' | 'success' | 'error';
  defaultExpanded?: boolean;
  expand?: React.ReactNode;
  handleExpandChange?: (isExpanded: boolean) => void;
  icon?: React.ReactNode;
  showIcon?: boolean;
  system?: boolean;
  trailingItems?: React.ReactNode;
}

export function Alert({
  icon,
  system,
  expand,
  trailingItems,
  className,
  children,
  type,
  ...props
}: AlertProps) {
  const showExpand = defined(expand);
  const [isExpanded, setIsExpanded] = useState(!!props.defaultExpanded);

  // Show the hover state (with darker borders) only when hovering over the
  // IconWrapper or MessageContainer.
  const {hoverProps} = useHover({
    isDisabled: !showExpand,
  });
  const {hoverProps: expandHoverProps} = useHover({
    isDisabled: !showExpand,
  });

  const expandRef = useRef<HTMLDivElement>(null);
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (
      // Only close the alert when the click event originated from outside the expanded
      // content.
      e.target === expandRef.current ||
      expandRef.current?.contains(e.target as HTMLDivElement)
    ) {
      return;
    }
    if (showExpand) {
      setIsExpanded(!isExpanded);
      props.handleExpandChange?.(!isExpanded);
    }
  }

  const showIcon = props.showIcon ?? true;

  return (
    <AlertContainer
      system={system}
      expand={expand}
      trailingItems={trailingItems}
      onClick={handleClick}
      className={classNames(type ? `ref-${type}` : '', className)}
      type={type === 'muted' ? 'subtle' : type === 'error' ? 'danger' : type}
      {...hoverProps}
      {...props}
      showIcon={showIcon}
    >
      <PanelProvider>
        {showIcon && (
          <IconWrapper type={type} onClick={handleClick}>
            {icon ?? <AlertIcon type={type} />}
          </IconWrapper>
        )}
        <Message>{children}</Message>
        {!!trailingItems && (
          <TrailingItems
            showIcon={!!showIcon}
            type={type === 'muted' ? 'subtle' : type === 'error' ? 'danger' : type}
            onClick={e => e.stopPropagation()}
          >
            {trailingItems}
          </TrailingItems>
        )}
        {showExpand && (
          <ExpandIconWrap>
            <Button
              size="zero"
              borderless
              icon={<IconChevron direction={isExpanded ? 'up' : 'down'} />}
              aria-label={isExpanded ? t('Collapse') : t('Expand')}
              onClick={() => {
                setIsExpanded(!isExpanded);
                props.handleExpandChange?.(!isExpanded);
              }}
            />
          </ExpandIconWrap>
        )}
        {isExpanded && (
          <Fragment>
            <ExpandContainer
              ref={expandRef}
              showIcon={!!showIcon}
              showTrailingItems={!!trailingItems}
              {...expandHoverProps}
            >
              {Array.isArray(expand) ? expand.map(item => item) : expand}
            </ExpandContainer>
          </Fragment>
        )}
      </PanelProvider>
    </AlertContainer>
  );
}

const AlertContainer = ChonkAlert.AlertPanel;

const IconWrapper = ChonkAlert.IconWrapper;

const Message = ChonkAlert.Message;

const TrailingItems = ChonkAlert.TrailingItems;

const ExpandIconWrap = ChonkAlert.ExpandIconWrap;

const ExpandContainer = ChonkAlert.ExpandContainer;

function AlertIcon({type}: {type: AlertProps['type']}): React.ReactNode {
  switch (type) {
    case 'warning':
      return <IconWarning />;
    case 'success':
      return <IconCheckmark />;
    case 'error':
      return <IconNot />;
    case 'info':
    case 'muted':
      return <IconInfo />;
    default:
      unreachable(type);
  }

  return null;
}

/**
 * Manages margins of Alert components
 */
const Container = styled('div')`
  > div {
    margin-bottom: ${space(2)};
  }
`;

Alert.Container = Container;

function AlertButton(props: DistributedOmit<ButtonProps, 'size'>) {
  const theme = useTheme();
  return <Button {...props} size={theme.isChonk ? 'zero' : 'sm'} />;
}

Alert.Button = AlertButton;
