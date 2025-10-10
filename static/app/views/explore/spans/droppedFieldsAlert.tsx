import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Text} from 'sentry/components/core/text';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {useExploreId} from 'sentry/views/explore/contexts/pageParamsContext';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';

export function DroppedFieldsAlert(): React.JSX.Element | null {
  const id = useExploreId();
  const {data: savedQuery} = useGetSavedQuery(id);

  if (!savedQuery) {
    return null;
  }

  if (!savedQuery.changedReason) {
    return null;
  }

  const baseWarning = t(
    "This widget may look different from the original query. Here's why:"
  );
  const columnsWarning = [];
  const equationsWarning = [];
  const orderbyWarning = [];

  const changedReason = savedQuery.changedReason;
  if (changedReason.columns.length > 0) {
    columnsWarning.push(
      tct(`The following columns were dropped: [columns]`, {
        columns: changedReason.columns.join(', '),
      })
    );
  }
  if (changedReason.equations) {
    equationsWarning.push(
      ...changedReason.equations.map(equation =>
        tct(`[equation] was dropped because [reason] is unsupported`, {
          equation: equation.equation,
          reason: equation.reason,
        })
      )
    );
  }
  if (changedReason.orderby) {
    orderbyWarning.push(
      ...changedReason.orderby.map(equation =>
        tct(`[orderby] was dropped because [reason]`, {
          orderby: equation.orderby,
          reason: equation.reason,
        })
      )
    );
  }

  const allWarnings = [...columnsWarning, ...equationsWarning, ...orderbyWarning];

  if (allWarnings.length > 0) {
    return (
      <StyledAlert type="warning">
        <StyledText as="p">{baseWarning}</StyledText>
        <List symbol="bullet">
          {allWarnings.map((warning, index) => (
            <ListItem key={index}>{warning}</ListItem>
          ))}
        </List>
      </StyledAlert>
    );
  }

  return null;
}

const StyledText = styled(Text)`
  padding-bottom: ${p => p.theme.space.xs};
`;

const StyledAlert = styled(Alert)`
  margin-bottom: ${p => p.theme.space.md};
`;
