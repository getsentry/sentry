import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  nextDisabled: boolean;
  onNext: React.MouseEventHandler;
  onPrevious: React.MouseEventHandler;
  previousDisabled: boolean;
  className?: string;
  headerText?: React.ReactNode;
};

function ScreenshotPagination({
  className,
  previousDisabled,
  nextDisabled,
  headerText,
  onPrevious,
  onNext,
}: Props) {
  return (
    <Wrapper className={className} lightText>
      <Button
        icon={<IconChevron direction="left" />}
        aria-label={t('Previous')}
        size="xs"
        disabled={previousDisabled}
        onClick={onPrevious}
      />
      <span>{headerText}</span>
      <Button
        icon={<IconChevron direction="right" />}
        aria-label={t('Next')}
        size="xs"
        disabled={nextDisabled}
        onClick={onNext}
      />
    </Wrapper>
  );
}

const Wrapper = styled(PanelHeader)`
  margin: 0;
  padding: 0;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-transform: none;
  background: ${p => p.theme.tokens.background.primary};
`;

export default ScreenshotPagination;
