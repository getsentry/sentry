import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import {ThreadStates} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import TextOverflow from 'sentry/components/textOverflow';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  details: ThreadInfo;
  id: number;
  name?: string | null;
};

type ThreadInfo = {
  filename?: string;
  label?: string;
  state?: ThreadStates;
};

function getThreadLabel(details: ThreadInfo, name?: string | null) {
  if (!isNil(name) && name) {
    return name;
  }
  return details?.label || `<${t('unknown')}>`;
}

function SelectedOption({id, name, details}: Props) {
  return (
    <Wrapper>
      <ThreadId>{tct('Thread #[id]:', {id})}</ThreadId>
      <Label>{getThreadLabel(details, name)}</Label>
    </Wrapper>
  );
}

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
