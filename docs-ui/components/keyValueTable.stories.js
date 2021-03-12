/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import {Key, KeyValueTable, KeyValueTable2, Value} from 'app/components/keyValueTable';

const Wrapper = styled('div')`
  width: 250px;
`;

export default {
  title: 'Core/KeyValueTable',
  component: KeyValueTable,
};

export const First = () => (
  <Wrapper>
    <KeyValueTable>
      <Key>Coffee</Key> <Value>Black hot drink</Value>
      <Key>Milk</Key> <Value>White cold drink</Value>
      <Key>Coffee</Key> <Value>Black hot drink</Value>
      <Key>Milk</Key> <Value>White cold drink</Value>
      <Key>Coffee</Key> <Value>Black hot drink</Value>
      <Key>Milk</Key> <Value>White cold drink</Value>
    </KeyValueTable>
  </Wrapper>
);
First.storyName = 'First';

export const Second = () => (
  <Wrapper>
    <KeyValueTable2
      data={[
        ['Coffee', 'Black hot drink'],
        ['Milk', 'White cold drink'],
        ['Coffee', 'Black hot drink'],
        ['Milk', 'White cold drink'],
        ['Coffee', 'Black hot drink'],
        ['Milk', 'White cold drink'],
        ['Coffee', 'Black hot drink'],
        ['Milk', 'White cold drink'],
      ]}
    />
  </Wrapper>
);
Second.storyName = 'Second';
