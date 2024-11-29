import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type WidgetBuilderSlideoutProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default WidgetBuilderSlideout;

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
    </SlideOverPanel>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  height: fit-content;
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const SlideoutTitle = styled('h5')``;

const SlideoutHeaderWrapper = styled('div')`
  padding: ${space(4)};
  display: flex;
  justify-content: space-between;
`;
