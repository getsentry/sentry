import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useParams} from 'sentry/utils/useParams';
import type {Widget} from 'sentry/views/dashboards/types';
import WidgetBuilderDatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import DevBuilder from 'sentry/views/dashboards/widgetBuilder/components/devBuilder';
import WidgetBuilderFilterBar from 'sentry/views/dashboards/widgetBuilder/components/filtersBar';
import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import SaveButton from 'sentry/views/dashboards/widgetBuilder/components/saveButton';
import WidgetBuilderTypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';

type WidgetBuilderSlideoutProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
};

function WidgetBuilderSlideout({isOpen, onClose, onSave}: WidgetBuilderSlideoutProps) {
  const {widgetIndex} = useParams();
  const isEditing = widgetIndex !== undefined;
  const title = isEditing ? t('Edit Widget') : t('Create Custom Widget');

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
          <WidgetBuilderQueryFilterBuilder />
        </Section>
        <Section>
          <WidgetBuilderNameAndDescription />
        </Section>
        <SaveButton isEditing={isEditing} onSave={onSave} />
        <DevBuilder />
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
