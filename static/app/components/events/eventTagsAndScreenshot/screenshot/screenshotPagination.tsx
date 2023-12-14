// eslint-disable-next-line no-restricted-imports
import {ReactEventHandler} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  nextDisabled: boolean;
  onNext: ReactEventHandler;
  onPrevious: ReactEventHandler;
  previousDisabled: boolean;
  headerText?: React.ReactNode;
};

function ScreenshotPagination({
  previousDisabled,
  nextDisabled,
  headerText,
  onPrevious,
  onNext,
}: Props) {
  return (
    <Wrapper lightText>
      <Button
        icon={<IconChevron direction="left" />}
        aria-label={t('Previous')}
        size="xs"
        disabled={previousDisabled}
        onClick={onPrevious}
      />
      <span data-test-id="pagination-header-text">{headerText}</span>
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
  background: ${p => p.theme.background};
`;

export default ScreenshotPagination;
