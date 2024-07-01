import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {inputStyles} from 'sentry/components/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type SearchQueryBuilderErrorHandlerProps = {
  reset: () => void;
  className?: string;
};

export function SearchQueryBuilderErrorHandler({
  className,
  reset,
}: SearchQueryBuilderErrorHandlerProps) {
  return (
    <Wrapper className={className}>
      <div>{t('Something went horribly wrong.')}</div>
      <Button onClick={reset} size="xs">
        {t('Reset')}
      </Button>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  ${inputStyles}
  min-height: 38px;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  border-color: ${p => p.theme.errorText};
  color: ${p => p.theme.errorText};
  background-color: ${p => p.theme.alert.error.backgroundLight};

  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${space(1)};
`;
