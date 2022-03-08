import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {QueryField} from 'sentry/views/eventsV2/table/queryField';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

type Props = {
  fieldOptions: ReturnType<typeof generateFieldOptions>;
};

export function GroupBy({fieldOptions}: Props) {
  return (
    <React.Fragment>
      <Field inline={false} flexibleControlStateSize stacked>
        <QueryFieldWrapper>
          <QueryField
            fieldValue={{field: '', kind: 'field'}}
            fieldOptions={fieldOptions}
            onChange={() => {}}
            filterPrimaryOptions={() => true}
            filterAggregateParameters={() => true}
          />
        </QueryFieldWrapper>
      </Field>
      <Button size="small" icon={<IconAdd isCircled />} onClick={() => {}}>
        {t('Add Group')}
      </Button>
    </React.Fragment>
  );
}

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;

  :not(:last-child) {
    margin-bottom: ${space(1)};
  }

  > * + * {
    margin-left: ${space(1)};
  }
`;
