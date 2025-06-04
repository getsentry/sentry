import type {ReactNode} from 'react';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';

import Collapsible from 'sentry/components/collapsible';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  tags: Record<string, string | ReactNode>;
}

export default function TagsSection({tags}: Props) {
  const orderedEntries = orderBy(Object.entries(tags), ['key'], ['asc']);

  return (
    <KeyValueTable noMargin>
      <Collapsible
        maxVisibleItems={3}
        collapseButton={({onCollapse}) => (
          <StyledButton priority="primary" size="xs" onClick={onCollapse}>
            {t('Collapse tags')}
          </StyledButton>
        )}
        expandButton={({onExpand}) => (
          <StyledButton priority="primary" size="xs" onClick={onExpand}>
            {t('See all tags')}
          </StyledButton>
        )}
      >
        {orderedEntries.map(([key, value]) => (
          <KeyValueTableRow
            key={key}
            keyName={key}
            value={
              <Tooltip showOnlyOnOverflow title={value}>
                <TextOverflow>{value}</TextOverflow>
              </Tooltip>
            }
          />
        ))}
      </Collapsible>
    </KeyValueTable>
  );
}

const StyledButton = styled(Button)`
  margin-top: ${space(1)};
  width: 150px;
`;
