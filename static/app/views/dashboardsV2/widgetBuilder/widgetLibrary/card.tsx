import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';
import {getWidgetIcon} from 'sentry/views/dashboardsV2/widgetLibrary/widgetCard';

type CardProps = {
  iconColor: string;
  onClick: () => void;
  widget: WidgetTemplate;
};

export function Card({widget, iconColor, onClick}: CardProps) {
  const {title, description, displayType} = widget;
  const Icon = getWidgetIcon(displayType);

  return (
    <Container onClick={onClick}>
      <IconWrapper backgroundColor={iconColor}>
        <Icon color="white" />
      </IconWrapper>
      <Information>
        <Heading>{title}</Heading>
        <SubHeading>{description}</SubHeading>
      </Information>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  cursor: pointer;
  padding: calc(${space(2)} - 1px);
  border: 1px solid transparent;
  border-radius: ${p => p.theme.borderRadius};
  transition: border-color 0.3s ease;

  &:hover {
    border-color: ${p => p.theme.gray100};
  }
`;

const Information = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Heading = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 500;
  margin-bottom: 0;
  color: ${p => p.theme.gray500};
`;

const SubHeading = styled('small')`
  color: ${p => p.theme.gray300};
`;

const IconWrapper = styled('div')<{backgroundColor: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(1)};
  min-width: 40px;
  height: 40px;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.backgroundColor};
`;
