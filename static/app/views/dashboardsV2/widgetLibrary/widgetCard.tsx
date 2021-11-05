import * as React from 'react';
import styled from '@emotion/styled';

import Card from 'app/components/card';
import space from 'app/styles/space';

import {DisplayType} from '../types';
import {miniWidget} from '../utils';

type Props = {
  title: string;
  displayType: DisplayType;
  onEventClick?: () => void;
};

function WidgetLibraryCard({title, displayType}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardContent>
          <Title>{title}</Title>
        </CardContent>
      </CardHeader>
      <CardBody>
        <WidgetImage src={miniWidget(displayType)} />
      </CardBody>
      <CardFooter>{'FOOTER'}</CardFooter>
    </Card>
  );
}

const CardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const Title = styled('div')`
  color: ${p => p.theme.textColor};
`;

const CardBody = styled('div')`
  background: ${p => p.theme.gray100};
  padding: ${space(1.5)} ${space(2)};
  max-height: 150px;
  min-height: 150px;
  overflow: hidden;
`;

const CardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const WidgetImage = styled('img')`
  width: 100%;
  height: 100%;
`;

export default WidgetLibraryCard;
