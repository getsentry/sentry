import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  icon: React.ReactElement;
  type: 'stack_unwinding' | 'symbolication';
  className?: string;
};

function Item({type, icon, className}: Props) {
  function getLabel() {
    switch (type) {
      case 'stack_unwinding':
        return t('Stack Unwinding');
      case 'symbolication':
        return t('Symbolication');
      default: {
        Sentry.captureException(new Error('Unknown Images Loaded processing item type'));
        return null; // This shall not happen
      }
    }
  }

  return (
    <Wrapper className={className}>
      {icon}
      {getLabel()}
    </Wrapper>
  );
}

export default Item;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(0.5)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
`;
