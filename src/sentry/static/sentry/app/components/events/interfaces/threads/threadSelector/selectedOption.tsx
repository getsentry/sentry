import React from 'react';
import styled from '@emotion/styled';

import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';
import {tct, t} from 'app/locale';

type Props = {
  id: number;
  details: ThreadInfo;
};

type ThreadInfo = {
  label?: string;
  filename?: string;
};

const SelectedOption = ({id, details}: Props) => (
  <Wrapper>
    <ThreadId>{tct('Thread #[id]:', {id})}</ThreadId>
    <Label>{details?.label || `<${t('unknown')}>`}</Label>
  </Wrapper>
);

export default SelectedOption;

const Wrapper = styled('div')`
  grid-template-columns: auto 1fr;
  display: grid;
`;

const ThreadId = styled(TextOverflow)`
  padding-right: ${space(1)};
  max-width: 100%;
  text-align: left;
`;

const Label = styled(ThreadId)`
  color: ${p => p.theme.blue400};
`;
