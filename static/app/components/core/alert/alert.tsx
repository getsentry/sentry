import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {DistributedOmit} from 'type-fest';

import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconCheckmark, IconChevron, IconInfo, IconNot, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import PanelProvider from 'sentry/utils/panelProvider';
import type {AlertVariant} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';

import * as ChonkAlert from './alert.chonk';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: AlertVariant;
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
  variant,
  ...props
}: AlertProps) {
  const showExpand = defined(expand);
  const [isExpanded, setIsExpanded] = useState(!!props.defaultExpanded);

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
      className={classNames(variant ? `ref-${variant}` : '', className)}
      variant={variant}
      {...props}
      showIcon={showIcon}
    >
      <PanelProvider>
        {showIcon && (
          <IconWrapper variant={variant} onClick={handleClick}>
            {icon ?? <AlertIcon variant={variant} />}
          </IconWrapper>
        )}
        <Message>{children}</Message>
        {!!trailingItems && (
          <TrailingItems onClick={e => e.stopPropagation()}>
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

function AlertIcon({variant}: {variant: AlertProps['variant']}): React.ReactNode {
  switch (variant) {
    case 'warning':
      return <IconWarning />;
    case 'success':
      return <IconCheckmark />;
    case 'danger':
      return <IconNot />;
    case 'info':
    case 'muted':
      return <IconInfo />;
    default:
      unreachable(variant);
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
  return <Button {...props} size="zero" />;
}

Alert.Button = AlertButton;
