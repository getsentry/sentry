import styled from '@emotion/styled';

import Badge, {type BadgeProps} from 'sentry/components/badge/badge';
import {Button, LinkButton} from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconExpand, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {ErrorPanel} from './errorPanel';
import {MIN_HEIGHT, MIN_WIDTH} from './settings';
import {TooltipIconTrigger} from './tooltipIconTrigger';
import type {StateProps} from './types';
import {WarningsList} from './warningsList';

export interface WidgetFrameProps extends StateProps {
  actions?: MenuItemProps[];
  actionsDisabled?: boolean;
  actionsMessage?: string;
  badgeProps?: BadgeProps | BadgeProps[];
  children?: React.ReactNode;
  description?: string;
  onFullScreenViewClick?: () => void;
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
        : []
      : props.actions) ?? [];

  return (
    <Frame>
      <Header>
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

        {(props.description ||
          props.onFullScreenViewClick ||
          (actions && actions.length > 0)) && (
          <TitleHoverItems>
            {props.description && (
              <QuestionTooltip title={props.description} size="sm" icon="info" />
            )}

            <TitleActionsWrapper
              disabled={Boolean(props.actionsDisabled)}
              disabledMessage={props.actionsMessage ?? ''}
            >
              {actions.length === 1 ? (
                actions[0].to ? (
                  <LinkButton
                    size="xs"
                    disabled={props.actionsDisabled}
                    onClick={actions[0].onAction}
                    to={actions[0].to}
                  >
                    {actions[0].label}
                  </LinkButton>
                ) : (
                  <Button
                    size="xs"
                    disabled={props.actionsDisabled}
                    onClick={actions[0].onAction}
                  >
                    {actions[0].label}
                  </Button>
                )
              ) : null}

              {actions.length > 1 ? (
                <DropdownMenu
                  items={actions}
                  isDisabled={props.actionsDisabled}
                  triggerProps={{
                    'aria-label': t('Actions'),
                    size: 'xs',
                    borderless: true,
                    showChevron: false,
                    icon: <IconEllipsis direction="down" size="sm" />,
                  }}
                  position="bottom-end"
                />
              ) : null}
            </TitleActionsWrapper>

            {props.onFullScreenViewClick && (
              <Button
                aria-label={t('Open Full-Screen View')}
                borderless
                size="xs"
                icon={<IconExpand />}
                onClick={() => {
                  props.onFullScreenViewClick?.();
                }}
              />
            )}
          </TitleHoverItems>
        )}
      </Header>

      <VisualizationWrapper>
        {props.error ? <ErrorPanel error={error} /> : props.children}
      </VisualizationWrapper>
    </Frame>
  );
}

const TitleHoverItems = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-left: auto;

  opacity: 1;
  transition: opacity 0.1s;
`;

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

const Frame = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;

  height: 100%;
  min-height: ${MIN_HEIGHT}px;
  width: 100%;
  min-width: ${MIN_WIDTH}px;

  padding: ${space(1.5)} ${space(2)};

  border-radius: ${p => p.theme.panelBorderRadius};
  border: ${p => p.theme.border};
  border: 1px ${p => 'solid ' + p.theme.border};

  background: ${p => p.theme.background};

  :hover {
    background-color: ${p => p.theme.surface200};
    transition:
      background-color 100ms linear,
      box-shadow 100ms linear;
    box-shadow: ${p => p.theme.dropShadowLight};
  }

  &:not(:hover):not(:focus-within) {
    ${TitleHoverItems} {
      opacity: 0;
      ${p => p.theme.visuallyHidden}
    }
  }
`;

const HEADER_HEIGHT = 26;

const Header = styled('div')`
  display: flex;
  align-items: center;
  height: ${HEADER_HEIGHT}px;
  gap: ${space(0.75)};
`;

const TitleText = styled(HeaderTitle)`
  ${p => p.theme.overflowEllipsis};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const RigidBadge = styled(Badge)`
  flex-shrink: 0;
`;

const VisualizationWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  position: relative;
`;
