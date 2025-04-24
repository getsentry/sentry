import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';

import {DisplayType} from './types';
import WidgetWrapper from './widgetWrapper';

export const ADD_WIDGET_BUTTON_DRAG_ID = 'add-widget-button';

const initialStyles = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
};

type Props = {
  onAddWidget: (dataset: DataSet) => void;
  onAddWidgetFromNewWidgetBuilder?: (
    dataset: DataSet,
    openWidgetTemplates?: boolean
  ) => void;
};

function AddWidget({onAddWidget, onAddWidgetFromNewWidgetBuilder}: Props) {
  const {setNodeRef, transform} = useSortable({
    disabled: true,
    id: ADD_WIDGET_BUTTON_DRAG_ID,
    transition: null,
  });

  const organization = useOrganization();

  const defaultDataset = organization.features.includes(
    'performance-discover-dataset-selector'
  )
    ? DataSet.ERRORS
    : DataSet.EVENTS;

  const addWidgetDropdownItems: MenuItemProps[] = [
    {
      key: 'create-custom-widget',
      label: t('Create Custom Widget'),
      onAction: () => onAddWidgetFromNewWidgetBuilder?.(defaultDataset, false),
    },
    {
      key: 'from-widget-library',
      label: t('From Widget Library'),
      onAction: () => onAddWidgetFromNewWidgetBuilder?.(defaultDataset, true),
    },
  ];

  return (
    <Feature features="dashboards-edit">
      <WidgetWrapper
        key="add"
        ref={setNodeRef}
        displayType={DisplayType.BIG_NUMBER}
        layoutId={ADD_WIDGET_BUTTON_DRAG_ID}
        style={{originX: 0, originY: 0}}
        animate={
          transform
            ? {
                x: transform.x,
                y: transform.y,
                scaleX: transform?.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
                scaleY: transform?.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1,
              }
            : initialStyles
        }
        transition={{
          duration: 0.25,
        }}
      >
        {organization.features.includes('dashboards-widget-builder-redesign') ? (
          <InnerWrapper onClick={() => onAddWidgetFromNewWidgetBuilder?.(defaultDataset)}>
            <DropdownMenu
              items={addWidgetDropdownItems}
              data-test-id="widget-add"
              triggerProps={{
                'aria-label': t('Add Widget'),
                size: 'md',
                showChevron: false,
                icon: <IconAdd isCircled size="lg" color="subText" />,
                borderless: true,
              }}
            />
          </InnerWrapper>
        ) : (
          <InnerWrapper onClick={() => onAddWidget(defaultDataset)}>
            <AddButton
              data-test-id="widget-add"
              icon={<IconAdd size="lg" isCircled color="subText" />}
              aria-label={t('Add widget')}
            />
          </InnerWrapper>
        )}
      </WidgetWrapper>
    </Feature>
  );
}

const AddButton = styled(Button)`
  border: none;
  &,
  &:focus,
  &:active,
  &:hover {
    background: transparent;
    box-shadow: none;
  }
`;

export default AddWidget;

const InnerWrapper = styled('div')<{onClick?: () => void}>`
  width: 100%;
  height: 110px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${p => (p.onClick ? 'pointer' : '')};
`;
