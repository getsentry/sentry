import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Text} from 'sentry/components/core/text';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {stripEquationPrefix} from 'sentry/utils/discover/fields';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useQueryParamsId} from 'sentry/views/explore/queryParams/context';

export function DroppedFieldsAlert(): React.JSX.Element | null {
  const id = useQueryParamsId();
  const {data: savedQuery} = useGetSavedQuery(id);

  if (!savedQuery) {
    return null;
  }

  if (!savedQuery.changedReason) {
    return null;
  }

  const baseWarning = t(
    "This query may look different from the original query. Here's why:"
  );
  const columnsWarning = [];
  const equationsWarning = [];
  const orderbyWarning = [];

  const changedReason = savedQuery.changedReason;
  if (changedReason.columns.length > 0) {
    columnsWarning.push(
      tct(`[columns] is no longer supported`, {
        columns: changedReason.columns.join(', '),
      })
    );
  }
  if (changedReason.equations) {
    equationsWarning.push(
      ...changedReason.equations.map(equation =>
        tct(`[equation] is no longer supported because [reason] is unsupported`, {
          equation: stripEquationPrefix(equation.equation),
          reason:
            typeof equation.reason === 'string'
              ? equation.reason
              : equation.reason.join(', '),
        })
      )
    );
  }
  if (changedReason.orderby) {
    orderbyWarning.push(
      ...changedReason.orderby.map(orderby => {
        const orderbyWithoutPrefix = orderby.orderby.startsWith('-')
          ? orderby.orderby.replace('-', '')
          : orderby.orderby;
        const reasonText =
          typeof orderby.reason === 'string' ? orderby.reason : orderby.reason.join(', ');

        // make sure that the reason and the orderby aren't the same and word it correctly
        return typeof orderby.reason === 'string' || orderbyWithoutPrefix === reasonText
          ? tct(`sorting by [orderby] is no longer supported`, {
              orderby: orderbyWithoutPrefix,
            })
          : tct(`sorting by [orderby] is not supported because [reason] is unsupported`, {
              orderby: orderby.orderby,
              reason: reasonText,
            });
      })
    );
  }

  const allWarnings = [...columnsWarning, ...equationsWarning, ...orderbyWarning];

  if (allWarnings.length > 0) {
    return (
      <StyledAlert variant="warning">
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
