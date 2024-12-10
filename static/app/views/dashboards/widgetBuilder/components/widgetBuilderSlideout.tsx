import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useParams} from 'sentry/utils/useParams';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import WidgetBuilderDatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import WidgetBuilderFilterBar from 'sentry/views/dashboards/widgetBuilder/components/filtersBar';
import WidgetBuilderGroupBySelector from 'sentry/views/dashboards/widgetBuilder/components/groupBySelector';
import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import SaveButton from 'sentry/views/dashboards/widgetBuilder/components/saveButton';
import WidgetBuilderSortBySelector from 'sentry/views/dashboards/widgetBuilder/components/sortBySelector';
import WidgetBuilderTypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import Visualize from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

type WidgetBuilderSlideoutProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
};

function WidgetBuilderSlideout({isOpen, onClose, onSave}: WidgetBuilderSlideoutProps) {
  const {state} = useWidgetBuilderContext();
  const {widgetIndex} = useParams();
  const isEditing = widgetIndex !== undefined;
  const title = isEditing ? t('Edit Widget') : t('Create Custom Widget');
  const isChartWidget =
    state.displayType !== DisplayType.BIG_NUMBER &&
    state.displayType !== DisplayType.TABLE;

  const isNotBigNumberWidget = state.displayType !== DisplayType.BIG_NUMBER;

  return (
    <SlideOverPanel
      collapsed={!isOpen}
      slidePosition="left"
      data-test-id="widget-slideout"
    >
      <SlideoutHeaderWrapper>
        <SlideoutTitle>{title}</SlideoutTitle>
        <CloseButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Close Widget Builder')}
          icon={<IconClose size="sm" />}
          onClick={onClose}
        >
          {t('Close')}
        </CloseButton>
      </SlideoutHeaderWrapper>
      <SlideoutBodyWrapper>
        <Section>
          <WidgetBuilderFilterBar />
        </Section>
        <Section>
          <WidgetBuilderDatasetSelector />
        </Section>
        <Section>
          <WidgetBuilderTypeSelector />
        </Section>
        <Section>
          <Visualize />
        </Section>
        <Section>
          <WidgetBuilderQueryFilterBuilder />
        </Section>
        {isChartWidget && (
          <Section>
            <WidgetBuilderGroupBySelector />
          </Section>
        )}
        {isNotBigNumberWidget && (
          <Section>
            <WidgetBuilderSortBySelector />
          </Section>
        )}
        <Section>
          <WidgetBuilderNameAndDescription />
        </Section>
        <SaveButton isEditing={isEditing} onSave={onSave} />
      </SlideoutBodyWrapper>
    </SlideOverPanel>
  );
}

export default WidgetBuilderSlideout;

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  height: fit-content;
  &:hover {
    color: ${p => p.theme.gray400};
  }
  z-index: 100;
`;

const SlideoutTitle = styled('h5')`
  margin: 0;
`;

const SlideoutHeaderWrapper = styled('div')`
  padding: ${space(3)} ${space(4)};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SlideoutBodyWrapper = styled('div')`
  padding: ${space(4)};
`;

const Section = styled('div')`
  margin-bottom: ${space(4)};
`;
