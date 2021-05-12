import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';

type Props = {
  goNextDisabled: boolean;
  isLoading: boolean;
  onCancel?: () => void;
  onGoBack?: () => void;
  onGoNext?: () => void;
};

function StepActions({goNextDisabled, isLoading, onCancel, onGoBack, onGoNext}: Props) {
  return (
    <Wrapper>
      <ButtonBar gap={1}>
        {onCancel && (
          <Button size="small" onClick={onCancel}>
            {t('Cancel')}
          </Button>
        )}
        {onGoBack && (
          <Button size="small" onClick={onGoBack}>
            {t('Back')}
          </Button>
        )}
        {onGoNext && (
          <StyledButton
            size="small"
            priority="primary"
            onClick={onGoNext}
            disabled={goNextDisabled}
          >
            {isLoading && (
              <LoadingIndicatorWrapper>
                <LoadingIndicator mini />
              </LoadingIndicatorWrapper>
            )}
            {t('Next')}
          </StyledButton>
        )}
      </ButtonBar>
    </Wrapper>
  );
}

export default StepActions;

const Wrapper = styled('div')`
  display: flex;
`;

const StyledButton = styled(Button)`
  position: relative;
`;

const LoadingIndicatorWrapper = styled('div')`
  height: 100%;
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;
