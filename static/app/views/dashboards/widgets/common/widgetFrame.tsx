import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {ErrorPanel} from './errorPanel';
import {MIN_HEIGHT, MIN_WIDTH} from './settings';
import type {StateProps} from './types';

export interface Props extends StateProps {
  actions?: MenuItemProps[];
  children?: React.ReactNode;
  description?: string;
  title?: string;
}

export function WidgetFrame(props: Props) {
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
        <Tooltip title={props.title} containerDisplayMode="grid" showOnlyOnOverflow>
          <TitleText>{props.title}</TitleText>
        </Tooltip>

        {(props.description || (actions && actions.length > 0)) && (
          <TitleActions>
            {props.description && (
              <QuestionTooltip title={props.description} size="sm" icon="info" />
            )}

            {actions.length === 1 ? (
              actions[0].to ? (
                <LinkButton size="xs" onClick={actions[0].onAction} to={actions[0].to}>
                  {actions[0].label}
                </LinkButton>
              ) : (
                <Button size="xs" onClick={actions[0].onAction}>
                  {actions[0].label}
                </Button>
              )
            ) : null}

            {actions.length > 1 ? (
              <DropdownMenu
                items={actions}
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
          </TitleActions>
        )}
      </Header>

      <VisualizationWrapper>
        {props.error ? <ErrorPanel error={error} /> : props.children}
      </VisualizationWrapper>
    </Frame>
  );
}

const TitleActions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-left: auto;

  opacity: 1;
  transition: opacity 0.1s;
`;

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
    ${TitleActions} {
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

const VisualizationWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  position: relative;
`;
