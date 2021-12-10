import * as React from 'react';
import {useState} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody} from 'sentry/components/panels';
import {IconArrow, IconGlobe, IconGraph, IconMenu, IconNumber} from 'sentry/icons';
import {IconGraphArea} from 'sentry/icons/iconGraphArea';
import {IconGraphBar} from 'sentry/icons/iconGraphBar';
import space from 'sentry/styles/space';

import {DisplayType} from '../types';

import {WidgetTemplate} from './data';

type Props = {
  widget: WidgetTemplate;
  ['data-test-id']?: string;
  setSelectedWidgets: (widgets: WidgetTemplate[]) => void;
  setErrored: (errored: boolean) => void;
  selectedWidgets: WidgetTemplate[];
};

function WidgetLibraryCard({
  selectedWidgets,
  widget,
  setSelectedWidgets,
  ['data-test-id']: dataTestId,
}: Props) {
  const [selected, setSelected] = useState(selectedWidgets.includes(widget));

  function getWidgetIcon(displayType: DisplayType) {
    switch (displayType) {
      case DisplayType.TABLE:
        return <IconMenu size="xs" />;
      case DisplayType.WORLD_MAP:
        return <IconGlobe size="xs" />;
      case DisplayType.BIG_NUMBER:
        return <IconNumber size="xs" />;
      case DisplayType.BAR:
        return <IconGraphBar size="xs" />;
      case DisplayType.TOP_N:
        return <IconArrow size="xs" />;
      case DisplayType.AREA:
        return <IconGraphArea size="xs" />;
      case DisplayType.LINE:
      default:
        return <IconGraph size="xs" />;
    }
  }

  return (
    <StyledPanel
      data-test-id={dataTestId}
      selected={selected}
      onClick={() => {
        if (selected) {
          const updatedWidgets = selectedWidgets.filter(
            selectedWidget => widget !== selectedWidget
          );
          setSelectedWidgets(updatedWidgets);
        } else {
          const updatedWidgets = selectedWidgets.slice().concat(widget);
          setSelectedWidgets(updatedWidgets);
        }
        setSelected(!!!selected);
      }}
    >
      <PanelBody>
        <TitleContainer>
          {getWidgetIcon(widget.displayType)}
          <Title>{widget.title}</Title>
        </TitleContainer>
        <Description>{widget.description}</Description>
      </PanelBody>
    </StyledPanel>
  );
}

const Title = styled('div')`
  padding-left: ${space(1)};
  font-size: 16px;
  line-height: 140%;
  color: ${p => p.theme.gray500};
`;

const TitleContainer = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  padding-bottom: ${space(0.5)};
  display: flex;
  align-items: center;
`;

const Description = styled('div')`
  padding: 0 ${space(1)} ${space(1.5)} 36px;
  font-size: 14px;
  line-height: 21px;
  color: ${p => p.theme.gray300};
`;

type PanelProps = {
  selected?: boolean;
};

const StyledPanel = styled(Panel)<PanelProps>`
  margin-bottom: 0;
  border: ${p => '1px solid ' + p.theme.border};
  outline: ${p => (p.selected ? '2px solid' + p.theme.purple400 : undefined)};
  box-sizing: border-box;
  box-shadow: 0px 2px 1px rgba(0, 0, 0, 0.08);
  cursor: pointer;
`;

export default WidgetLibraryCard;
