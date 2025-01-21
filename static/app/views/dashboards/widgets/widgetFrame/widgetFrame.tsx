import {Fragment} from 'react';
import styled from '@emotion/styled';

import Badge, {type BadgeProps} from 'sentry/components/badge/badge';
import {Button, LinkButton} from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconInfo, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {ErrorPanel} from '../common/errorPanel';
import {WIDGET_RENDER_ERROR_MESSAGE} from '../common/settings';
import {TooltipIconTrigger} from '../common/tooltipIconTrigger';
import type {StateProps} from '../common/types';
import {WarningsList} from '../common/warningsList';

import {FullScreenViewButton} from './fullScreenViewButton';
import {WidgetLayout} from './widgetLayout';

export interface WidgetFrameProps extends StateProps {
  actions?: MenuItemProps[];
  actionsDisabled?: boolean;
  actionsMessage?: string;
  badgeProps?: BadgeProps | BadgeProps[];
  borderless?: boolean;
  children?: React.ReactNode;
  description?: React.ReactElement | string;
  onFullScreenViewClick?: () => void | Promise<void>;
  title?: string;
  warnings?: string[];
}

export function WidgetFrame(props: WidgetFrameProps) {
  const {error} = props;

  // The error state has its own set of available actions
  const actions =
    (error
      ? props.onRetry
        ? [
            {
              key: 'retry',
              label: t('Retry'),
              onAction: props.onRetry,
            },
          ]
        : props.actions
      : props.actions) ?? [];

  const shouldShowFullScreenViewButton =
    Boolean(props.onFullScreenViewClick) && !props.error;

  const shouldShowActions = actions && actions.length > 0;

  return (
    <WidgetLayout
      ariaLabel="Widget panel"
      Title={
        <Fragment>
          {props.warnings && props.warnings.length > 0 && (
            <Tooltip title={<WarningsList warnings={props.warnings} />} isHoverable>
              <TooltipIconTrigger aria-label={t('Widget warnings')}>
                <IconWarning color="warningText" />
              </TooltipIconTrigger>
            </Tooltip>
          )}

          <Tooltip title={props.title} containerDisplayMode="grid" showOnlyOnOverflow>
            <TitleText>{props.title}</TitleText>
          </Tooltip>

          {props.badgeProps &&
            (Array.isArray(props.badgeProps) ? props.badgeProps : [props.badgeProps]).map(
              (currentBadgeProps, i) => <RigidBadge key={i} {...currentBadgeProps} />
            )}
        </Fragment>
      }
      Actions={
        <Fragment>
          {props.description && (
            // Ideally we'd use `QuestionTooltip` but we need to firstly paint the icon dark, give it 100% opacity, and remove hover behaviour.
            <Tooltip
              title={
                <span>
                  {props.title && <WidgetTooltipTitle>{props.title}</WidgetTooltipTitle>}
                  {props.description && (
                    <WidgetTooltipDescription>
                      {props.description}
                    </WidgetTooltipDescription>
                  )}
                </span>
              }
              containerDisplayMode="grid"
              isHoverable
            >
              <WidgetTooltipButton
                aria-label={t('Widget description')}
                borderless
                size="xs"
                icon={<IconInfo size="sm" />}
              />
            </Tooltip>
          )}

          {shouldShowActions && (
            <TitleActionsWrapper
              disabled={Boolean(props.actionsDisabled)}
              disabledMessage={props.actionsMessage ?? ''}
            >
              {actions.length === 1 ? (
                actions[0]!.to ? (
                  <LinkButton
                    size="xs"
                    disabled={props.actionsDisabled}
                    onClick={actions[0]!.onAction}
                    to={actions[0]!.to}
                  >
                    {actions[0]!.label}
                  </LinkButton>
                ) : (
                  <Button
                    size="xs"
                    disabled={props.actionsDisabled}
                    onClick={actions[0]!.onAction}
                  >
                    {actions[0]!.label}
                  </Button>
                )
              ) : null}

              {actions.length > 1 ? (
                <DropdownMenu
                  items={actions}
                  isDisabled={props.actionsDisabled}
                  triggerProps={{
                    'aria-label': t('Widget actions'),
                    size: 'xs',
                    borderless: true,
                    showChevron: false,
                    icon: <IconEllipsis direction="down" size="sm" />,
                  }}
                  position="bottom-end"
                />
              ) : null}
            </TitleActionsWrapper>
          )}

          {shouldShowFullScreenViewButton && (
            <FullScreenViewButton
              onClick={() => {
                props.onFullScreenViewClick?.();
              }}
            />
          )}
        </Fragment>
      }
      Visualization={
        props.error ? (
          <ErrorPanel error={error} />
        ) : (
          <ErrorBoundary
            customComponent={<ErrorPanel error={WIDGET_RENDER_ERROR_MESSAGE} />}
          >
            {props.children}
          </ErrorBoundary>
        )
      }
    />
  );
}

interface TitleActionsProps {
  children: React.ReactNode;
  disabled: boolean;
  disabledMessage: string;
}

function TitleActionsWrapper({disabled, disabledMessage, children}: TitleActionsProps) {
  if (!disabled || !disabledMessage) {
    return children;
  }

  return (
    <Tooltip title={disabledMessage} isHoverable>
      {children}
    </Tooltip>
  );
}

const TitleText = styled(HeaderTitle)`
  ${p => p.theme.overflowEllipsis};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const RigidBadge = styled(Badge)`
  flex-shrink: 0;
`;

const WidgetTooltipTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: left;
`;

const WidgetTooltipDescription = styled('div')`
  margin-top: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: left;
`;

// We're using a button here to preserve tab accessibility
const WidgetTooltipButton = styled(Button)`
  pointer-events: none;
  padding-top: 0;
  padding-bottom: 0;
`;
