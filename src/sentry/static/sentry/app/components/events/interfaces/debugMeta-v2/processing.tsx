import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';

import NotAvailable from './notAvailable';

export enum ProcessingType {
  STACK_UNWINDING = 'stack_unwinding',
  SYMBOLICATION = 'symbolication',
}

type Item = {
  type: ProcessingType;
  icon: React.ReactElement;
};

type Props = {
  items: Array<Item>;
};

function Processing({items}: Props) {
  if (!items.length) {
    return <NotAvailable />;
  }

  function getLabel(type: ProcessingType) {
    switch (type) {
      case ProcessingType.STACK_UNWINDING:
        return t('Stack Unwinding');
      case ProcessingType.SYMBOLICATION:
        return t('Symbolication');
      default:
        return null; // this shall not happen
    }
  }

  return (
    <Wrapper>
      {items.map(({type, icon}) => (
        <Item key={type}>
          {icon}
          {getLabel(type)}
        </Item>
      ))}
    </Wrapper>
  );
}

export default Processing;

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Item = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(0.75)};
  align-items: center;
`;
