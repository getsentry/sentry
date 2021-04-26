import React from 'react';
import styled from '@emotion/styled';

import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';
import Textarea from 'app/views/settings/components/forms/controls/textarea';
import Field from 'app/views/settings/components/forms/field';

import {StepOneData} from './types';

type Props = {
  data: StepOneData;
  onChange: (data: StepOneData) => void;
};

function StepOne({onChange, data}: Props) {
  return (
    <StyledList symbol="colored-numeric">
      <ListItem>
        {t('Enter your App Store Connect credentials')}
        <ListItemContent>
          <Field
            label={t('Issuer')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <Input
              type="text"
              name="issuer"
              placeholder={t('Issuer')}
              value={data.issuer}
              onChange={e =>
                onChange({
                  ...data,
                  issuer: e.target.value,
                })
              }
            />
          </Field>
          <Field
            label={t('Key ID')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <Input
              type="text"
              name="keyId"
              placeholder={t('Key Id')}
              value={data.keyId}
              onChange={e =>
                onChange({
                  ...data,
                  keyId: e.target.value,
                })
              }
            />
          </Field>
          <Field
            label={t('Private Key')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <Textarea
              name="privateKey"
              placeholder={t('Private Key')}
              value={data.privateKey}
              autosize
              onChange={e =>
                onChange({
                  ...data,
                  privateKey: e.target.value,
                })
              }
            />
          </Field>
        </ListItemContent>
      </ListItem>
    </StyledList>
  );
}

export default StepOne;

const StyledList = styled(List)`
  grid-gap: ${space(2)};
`;

const ListItemContent = styled('div')`
  padding-top: ${space(2)};
`;
