import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export interface Props {
  actions?: MenuItemProps[];
  children?: React.ReactNode;
  description?: string;
  title?: string;
}

export function WidgetFrame(props: Props) {
  const {title, description, actions, children} = props;

  return (
    <Frame>
      <Header>
        <Title>
          <Tooltip title={title} containerDisplayMode="grid" showOnlyOnOverflow>
            <TitleText>{title}</TitleText>
          </Tooltip>

          {description && (
            <TooltipAligner>
              <QuestionTooltip size="sm" title={description} />
            </TooltipAligner>
          )}

          {actions && actions.length > 0 && (
            <TitleActions>
              {actions.length === 1 ? (
                <Button size="xs" onClick={actions[0].onAction}>
                  {actions[0].label}
                </Button>
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
        </Title>
      </Header>

      <VisualizationWrapper>{children}</VisualizationWrapper>
    </Frame>
  );
}

const Frame = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;

  height: 100%;
  min-height: 96px;
  width: 100%;
  min-width: 120px;

  padding: ${space(2)};

  border-radius: ${p => p.theme.panelBorderRadius};
  border: ${p => p.theme.border};
  border: 1px ${p => 'solid ' + p.theme.border};

  background: ${p => p.theme.background};
`;

const Header = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Title = styled('div')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const TitleText = styled(HeaderTitle)`
  ${p => p.theme.overflowEllipsis};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const TitleActions = styled('div')`
  margin-left: auto;
`;

const TooltipAligner = styled('div')`
  font-size: 0;
  line-height: 1;
  margin-bottom: 2px;
`;

const VisualizationWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  position: relative;
`;
