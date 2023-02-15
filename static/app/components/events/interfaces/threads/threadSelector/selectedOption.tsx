import styled from '@emotion/styled';

import TextOverflow from 'sentry/components/textOverflow';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  details: ThreadInfo;
  id: number;
};

type ThreadInfo = {
  filename?: string;
  label?: string;
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
  font-weight: 400;
`;
