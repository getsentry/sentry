import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Card from 'app/components/card';
import {IconAdd, IconCheckmark} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {miniWidget} from '../utils';

import {WidgetTemplate} from './data';

type Props = {
  widget: WidgetTemplate;
  setSelectedWidgets: (widgets: WidgetTemplate[]) => void;
  setErrored: (errored: boolean) => void;
  selectedWidgets: WidgetTemplate[];
};

function WidgetLibraryCard({
  selectedWidgets,
  widget,
  setSelectedWidgets,
  setErrored,
}: Props) {
  const selectButton = (
    <StyledButton
      type="button"
      icon={<IconAdd size="small" isCircled color="gray300" />}
      onClick={() => {
        const updatedWidgets = selectedWidgets.slice().concat(widget);
        setErrored(false);
        setSelectedWidgets(updatedWidgets);
      }}
    >
      {t('Select')}
    </StyledButton>
  );

  const selectedButton = (
    <StyledButton
      type="button"
      icon={<IconCheckmark size="small" isCircled color="gray300" />}
      onClick={() => {
        const updatedWidgets = selectedWidgets.filter(selected => widget !== selected);
        setSelectedWidgets(updatedWidgets);
      }}
      priority="primary"
    >
      {t('Selected')}
    </StyledButton>
  );

  return (
    <Card>
      <CardHeader>
        <CardContent>
          <Title>{widget.title}</Title>
        </CardContent>
      </CardHeader>
      <CardBody>
        <WidgetImage src={miniWidget(widget.displayType)} />
      </CardBody>
      <CardFooter>
        {selectedWidgets.includes(widget) ? selectedButton : selectButton}
      </CardFooter>
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

const StyledButton = styled(Button)`
  width: 100%;
  vertical-align: middle;
  > span:first-child {
    padding: 8px 16px;
  }
`;

const WidgetImage = styled('img')`
  width: 100%;
  height: 100%;
`;

export default WidgetLibraryCard;
