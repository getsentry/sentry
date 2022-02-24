import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {getWidgetIcon} from 'sentry/views/dashboardsV2/widgetLibrary/widgetCard';

export function Card({widget, iconColor}) {
  const {title, description, displayType} = widget;
  const Icon = getWidgetIcon(displayType);

  return (
    <Container>
      <IconWrapper backgroundColor={iconColor}>
        <Icon style={{color: '#FFF'}} />
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
`;

const Information = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Heading = styled('h5')`
  font-size: 1rem;
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
  padding: 8px;
  min-width: 40px;
  min-height: 40px;
  max-width: 40px;
  max-height: 40px;
  border-radius: 4px;
  background: ${p => p.backgroundColor};
`;
