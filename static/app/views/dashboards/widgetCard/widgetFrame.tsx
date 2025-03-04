import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {Badge} from 'sentry/components/core/badge';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconExpand, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {StateProps} from '../widgets/common/types';
import {Widget} from '../widgets/widget/widget';
import type {WidgetDescriptionProps} from '../widgets/widget/widgetDescription';

import {TooltipIconTrigger} from './tooltipIconTrigger';
import {WarningsList} from './warningsList';

export interface WidgetFrameProps extends StateProps, WidgetDescriptionProps {
  actions?: MenuItemProps[];
  actionsDisabled?: boolean;
  actionsMessage?: string;
  badgeProps?: string | string[];
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
    <Widget
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

          <Widget.WidgetTitle title={props.title} />

          {props.badgeProps &&
            (Array.isArray(props.badgeProps) ? props.badgeProps : [props.badgeProps]).map(
              (currentBadgeProps, i) => (
                <WidgetBadge key={i} type="default">
                  {currentBadgeProps}
                </WidgetBadge>
              )
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
            <Widget.WidgetDescription
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
            <Button
              size="xs"
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
      Visualization={props.error ? <Widget.WidgetError error={error} /> : props.children}
      noVisualizationPadding={props.noVisualizationPadding}
    />
  );
}

interface TitleActionsProps {
  children: React.ReactNode;
  disabled: boolean;
  disabledMessage: string;
}

const WidgetBadge = styled(Badge)`
  flex-shrink: 0;
`;

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
