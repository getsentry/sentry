import {useCallback, useMemo} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
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
      key: 'from-widget-library',
      label: t('From Widget Library'),
      onAction: () => onAddWidgetFromNewWidgetBuilder?.(defaultDataset, true),
    },
    {
      key: 'create-custom-widget',
      label: t('Create Custom Widget'),
      onAction: () => onAddWidgetFromNewWidgetBuilder?.(defaultDataset, false),
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
        {hasCustomMetrics(organization) ? (
          <InnerWrapper>
            <AddWidgetButton
              onAddWidget={onAddWidget}
              aria-label={t('Add Widget')}
              data-test-id="widget-add"
            />
          </InnerWrapper>
        ) : organization.features.includes('dashboards-widget-builder-redesign') ? (
          <InnerWrapper onClick={() => onAddWidgetFromNewWidgetBuilder?.(defaultDataset)}>
            <DropdownMenu
              items={addWidgetDropdownItems}
              data-test-id="widget-add"
              triggerProps={{
                'aria-label': t('Add Widget'),
                size: 'md',
                showChevron: false,
                icon: <IconAdd isCircled size="lg" color="inactive" />,
                borderless: true,
              }}
            />
          </InnerWrapper>
        ) : (
          <InnerWrapper onClick={() => onAddWidget(defaultDataset)}>
            <AddButton
              data-test-id="widget-add"
              icon={<IconAdd size="lg" isCircled color="inactive" />}
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

export function AddWidgetButton({onAddWidget, ...buttonProps}: Props & ButtonProps) {
  const organization = useOrganization();

  const handleAction = useCallback(
    (dataset: DataSet) => {
      trackAnalytics('dashboards_views.widget_library.opened', {
        organization,
      });
      onAddWidget(dataset);
    },
    [organization, onAddWidget]
  );

  const items = useMemo(() => {
    const menuItems: MenuItemProps[] = [];

    if (organization.features.includes('performance-discover-dataset-selector')) {
      menuItems.push({
        key: DataSet.ERRORS,
        label: t('Errors'),
        onAction: () => handleAction(DataSet.ERRORS),
      });
      menuItems.push({
        key: DataSet.TRANSACTIONS,
        label: t('Transactions'),
        onAction: () => handleAction(DataSet.TRANSACTIONS),
      });
    } else {
      menuItems.push({
        key: DataSet.EVENTS,
        label: t('Errors and Transactions'),
        onAction: () => handleAction(DataSet.EVENTS),
      });
    }

    menuItems.push({
      key: DataSet.ISSUES,
      label: t('Issues'),
      details: t('States, Assignment, Time, etc.'),
      onAction: () => handleAction(DataSet.ISSUES),
    });

    menuItems.push({
      key: DataSet.RELEASES,
      label: t('Releases'),
      details: t('Sessions, Crash rates, etc.'),
      onAction: () => handleAction(DataSet.RELEASES),
    });

    if (hasCustomMetrics(organization)) {
      menuItems.push({
        key: DataSet.METRICS,
        label: t('Metrics'),
        onAction: () => handleAction(DataSet.METRICS),
        trailingItems: (
          <FeatureBadge
            type="beta"
            title={
              'The Metrics beta will end and we will retire the current solution on October 7th, 2024'
            }
          />
        ),
      });
    }

    return menuItems;
  }, [handleAction, organization]);

  return (
    <DropdownMenu
      items={items}
      trigger={triggerProps => (
        <DropdownButton
          {...triggerProps}
          {...buttonProps}
          data-test-id="widget-add"
          size="sm"
          icon={<IconAdd isCircled />}
        >
          {t('Add Widget')}
        </DropdownButton>
      )}
      menuTitle={
        <MenuTitle>
          {t('Dataset')}
          <ExternalLink href="https://docs.sentry.io/product/dashboards/widget-builder/#choose-your-dataset">
            {t('Learn more')}
          </ExternalLink>
        </MenuTitle>
      }
    />
  );
}

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

const MenuTitle = styled('span')`
  display: flex;
  gap: ${space(1)};

  & > a {
    font-weight: ${p => p.theme.fontWeightNormal};
  }
`;
