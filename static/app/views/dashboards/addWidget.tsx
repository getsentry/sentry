import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {Button, ButtonProps} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {hasDDMExperimentalFeature, hasDDMFeature} from 'sentry/utils/metrics/features';
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
};

function AddWidget({onAddWidget}: Props) {
  const {setNodeRef, transform} = useSortable({
    disabled: true,
    id: ADD_WIDGET_BUTTON_DRAG_ID,
    transition: null,
  });

  const organization = useOrganization();

  return (
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
      {hasDDMExperimentalFeature(organization) ? (
        <InnerWrapper>
          <AddWidgetButton
            onAddWidget={onAddWidget}
            aria-label="Add Widget"
            data-test-id="widget-add"
          />
        </InnerWrapper>
      ) : (
        <InnerWrapper onClick={() => onAddWidget(DataSet.EVENTS)}>
          <AddButton
            data-test-id="widget-add"
            icon={<IconAdd size="lg" isCircled color="inactive" />}
            aria-label={t('Add widget')}
          />
        </InnerWrapper>
      )}
    </WidgetWrapper>
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

  const datasetChoices = new Map<string, string>();
  datasetChoices.set(DataSet.EVENTS, t('Errors and Transactions'));
  datasetChoices.set(DataSet.ISSUES, t('Issues (States, Assignment, Time, etc.)'));

  if (organization.features.includes('dashboards-rh-widget')) {
    datasetChoices.set(DataSet.RELEASES, t('Releases (Sessions, Crash rates)'));
  }

  if (hasDDMFeature(organization)) {
    datasetChoices.set(DataSet.METRICS, t('Custom Metrics'));
  }

  return (
    <CompactSelect
      options={[...datasetChoices.entries()].map(([value, label]) => ({
        label,
        value,
      }))}
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
      onChange={({value: dataset}) => {
        trackAnalytics('dashboards_views.widget_library.opened', {
          organization,
        });
        onAddWidget(dataset as DataSet);
      }}
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
