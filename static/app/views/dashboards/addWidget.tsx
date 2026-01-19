import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
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
  onAddWidget?: (dataset: DataSet, openWidgetTemplates?: boolean) => void;
};

function AddWidget({onAddWidget}: Props) {
  const {setNodeRef, transform} = useSortable({
    disabled: true,
    id: ADD_WIDGET_BUTTON_DRAG_ID,
    transition: null,
  });

  const defaultDataset = DataSet.ERRORS;

  const addWidgetDropdownItems: MenuItemProps[] = [
    {
      key: 'create-custom-widget',
      label: t('Create Custom Widget'),
      onAction: () => onAddWidget?.(defaultDataset, false),
    },
    {
      key: 'from-widget-library',
      label: t('From Widget Library'),
      onAction: () => onAddWidget?.(defaultDataset, true),
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
        <InnerWrapper onClick={() => onAddWidget?.(defaultDataset)}>
          <DropdownMenu
            items={addWidgetDropdownItems}
            data-test-id="widget-add"
            triggerProps={{
              'aria-label': t('Add Widget'),
              size: 'md',
              showChevron: false,
              icon: <IconAdd size="lg" variant="muted" />,
              borderless: true,
            }}
          />
        </InnerWrapper>
      </WidgetWrapper>
    </Feature>
  );
}

export default AddWidget;

const InnerWrapper = styled('div')<{onClick?: () => void}>`
  width: 100%;
  height: 110px;
  border: 2px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${p => (p.onClick ? 'pointer' : '')};
`;
