import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  type: 'stack_unwinding' | 'symbolication';
  icon: React.ReactElement;
};

function Item({type, icon}: Props) {
  function getLabel() {
    switch (type) {
      case 'stack_unwinding':
        return t('Stack Unwinding');
      case 'symbolication':
        return t('Symbolication');
      default: {
        Sentry.withScope(scope => {
          scope.setLevel(Sentry.Severity.Warning);
          Sentry.captureException(new Error("Unknown Item's type"));
        });
        return null; // This shall not happen
      }
    }
  }

  return (
    <Wrapper>
      {icon}
      {getLabel()}
    </Wrapper>
  );
}

export default Item;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(1.5)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
`;
