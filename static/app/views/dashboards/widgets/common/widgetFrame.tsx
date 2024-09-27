import styled from '@emotion/styled';

import {HeaderTitle} from 'sentry/components/charts/styles';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

export interface Props {
  children: React.ReactNode;
  description?: string;
  showDescriptionInTooltip?: boolean;
  title?: string;
}

export function WidgetFrame(props: Props) {
  const {title, description, showDescriptionInTooltip = true, children} = props;

  return (
    <Frame>
      <Header showDescriptionInTooltip={showDescriptionInTooltip}>
        <Title>
          <Tooltip title={title} containerDisplayMode="grid" showOnlyOnOverflow>
            <TitleText>{title}</TitleText>
          </Tooltip>

          {description && showDescriptionInTooltip && (
            <QuestionTooltip size="sm" title={description} />
          )}
        </Title>

        {description && !showDescriptionInTooltip && (
          <Tooltip
            title={description}
            containerDisplayMode="grid"
            showOnlyOnOverflow
            isHoverable
          >
            <Description>{description}</Description>
          </Tooltip>
        )}
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
  width: 100%;

  padding: ${space(2)};

  border-radius: ${p => p.theme.panelBorderRadius};
  border: ${p => p.theme.border};
  border: 1px ${p => 'solid ' + p.theme.border};

  background: ${p => p.theme.background};
`;

const Header = styled('div')<{showDescriptionInTooltip: boolean}>`
  display: flex;
  flex-direction: column;

  min-height: ${p => (p.showDescriptionInTooltip ? '' : '36px')};
`;

const Title = styled('div')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const Description = styled('small')`
  ${p => p.theme.overflowEllipsis}

  color: ${p => p.theme.gray300};
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
