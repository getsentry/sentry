import {Fragment} from 'react';

import type {BadgeProps} from 'sentry/components/badge/badge';
import {LinkButton} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconExpand, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';

import {ErrorPanel} from '../widgetLayout/errorPanel';
import {WidgetBadge} from '../widgetLayout/widgetBadge';
import {WidgetButton} from '../widgetLayout/widgetButton';
import {
  WidgetDescription,
  type WidgetDescriptionProps,
} from '../widgetLayout/widgetDescription';
import {WidgetLayout} from '../widgetLayout/widgetLayout';
import {WidgetTitle} from '../widgetLayout/widgetTitle';

import {WIDGET_RENDER_ERROR_MESSAGE} from './settings';
import {TooltipIconTrigger} from './tooltipIconTrigger';
import type {StateProps} from './types';
import {WarningsList} from './warningsList';

export interface WidgetFrameProps extends StateProps, WidgetDescriptionProps {
  actions?: MenuItemProps[];
  actionsDisabled?: boolean;
  actionsMessage?: string;
  badgeProps?: BadgeProps | BadgeProps[];
  borderless?: boolean;
  children?: React.ReactNode;
  noVisualizationPadding?: boolean;
  onFullScreenViewClick?: () => void | Promise<void>;
  revealActions?: 'always' | 'hover';
  revealTooltip?: 'always' | 'hover';
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
      borderless={props.borderless}
      Title={
        <Fragment>
          {props.warnings && props.warnings.length > 0 && (
            <Tooltip title={<WarningsList warnings={props.warnings} />} isHoverable>
              <TooltipIconTrigger aria-label={t('Widget warnings')}>
                <IconWarning color="warningText" />
              </TooltipIconTrigger>
            </Tooltip>
          )}

          <WidgetTitle title={props.title} />

          {props.badgeProps &&
            (Array.isArray(props.badgeProps) ? props.badgeProps : [props.badgeProps]).map(
              (currentBadgeProps, i) => <WidgetBadge key={i} {...currentBadgeProps} />
            )}
        </Fragment>
      }
      revealActions={
        props.revealTooltip === 'always' ? 'always' : props.revealActions ?? 'hover'
      }
      Actions={
        <Fragment>
          {props.description && (
            // Ideally we'd use `QuestionTooltip` but we need to firstly paint the icon dark, give it 100% opacity, and remove hover behaviour.
            <WidgetDescription
              title={props.title}
              description={props.description}
              revealTooltip={props.revealTooltip ?? 'hover'}
            />
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
                  <WidgetButton
                    disabled={props.actionsDisabled}
                    onClick={actions[0]!.onAction}
                  >
                    {actions[0]!.label}
                  </WidgetButton>
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
            <WidgetButton
              aria-label={t('Open Full-Screen View')}
              borderless
              icon={<IconExpand />}
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
      noVisualizationPadding={props.noVisualizationPadding}
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
