import styled from '@emotion/styled';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import type {
  AggregateFilter,
  ParseResultToken,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type AggregateKeyProps = {
  filterRef: React.RefObject<HTMLDivElement>;
  item: Node<ParseResultToken>;
  onActiveChange: (active: boolean) => void;
  state: ListState<ParseResultToken>;
  token: AggregateFilter;
};

export function AggregateKey({item, state, token}: AggregateKeyProps) {
  const {disabled} = useSearchQueryBuilder();

  const filterButtonProps = useFilterButtonProps({state, item});

  const fnName = getKeyName(token.key);
  const fnParams = token.key.args?.text ?? '';

  return (
    <KeyButton
      aria-label={t('Edit parameters for filter: %s', fnName)}
      disabled={disabled}
      {...filterButtonProps}
    >
      <InteractionStateLayer />
      <FnName>{fnName}</FnName>
      {'('}
      <Parameters>{fnParams}</Parameters>
      {')'}
    </KeyButton>
  );
}

const UnstyledButton = styled('button')`
  background: none;
  border: none;
  outline: none;
  padding: 0;
  user-select: none;

  :focus {
    outline: none;
  }
`;

const KeyButton = styled(UnstyledButton)`
  padding: 0 ${space(0.25)} 0 ${space(0.5)};
  height: 100%;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  border-radius: 3px 0 0 3px;

  :focus {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;

const FnName = styled('span')`
  color: ${p => p.theme.green400};
`;

const Parameters = styled('span')`
  height: 100%;

  &:not(:empty) {
    padding: 0 ${space(0.25)};
  }
`;
