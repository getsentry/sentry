import styled from '@emotion/styled';

import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';

const Wrapper = styled('div')`
  width: 250px;
`;

export default {
  title: 'Components/Tables/KeyValueTable',
  component: KeyValueTable,
};

export const Default = () => (
  <Wrapper>
    <KeyValueTable>
      <KeyValueTableRow keyName="Coffee" value="Black hot drink" />
      <KeyValueTableRow keyName="Milk" value={<a href="#">White cold drink</a>} />
      <KeyValueTableRow keyName="Coffee" value="Black hot drink" />
      <KeyValueTableRow keyName="Milk" value="White cold drink" />
      <KeyValueTableRow keyName="Coffee" value="Black hot drink" />
      <KeyValueTableRow keyName="Milk" value="White cold drink" />
    </KeyValueTable>
  </Wrapper>
);
Default.storyName = 'default';
