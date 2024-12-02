import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import WidgetBuilderDatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import DevBuilder from 'sentry/views/dashboards/widgetBuilder/components/devBuilder';
import WidgetBuilderFilterBar from 'sentry/views/dashboards/widgetBuilder/components/filtersBar';
import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';

type WidgetBuilderSlideoutProps = {
  isOpen: boolean;
  onClose: () => void;
};

function WidgetBuilderSlideout({isOpen, onClose}: WidgetBuilderSlideoutProps) {
  return (
    <SlideOverPanel collapsed={!isOpen} slidePosition="left">
      <SlideoutHeaderWrapper>
        <SlideoutTitle>{t('Create Custom Widget')}</SlideoutTitle>
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
          <WidgetBuilderNameAndDescription />
        </Section>
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
