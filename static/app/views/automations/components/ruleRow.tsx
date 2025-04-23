import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import InputField from 'sentry/components/forms/fields/inputField';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface RuleRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export default function RuleRow({onDelete, children}: RuleRowProps) {
  return (
    <RowContainer>
      <Row>
        <Rule>{children}</Rule>
        <DeleteButton
          aria-label={t('Delete Node')}
          size="sm"
          icon={<IconDelete />}
          borderless
          onClick={onDelete}
        />
      </Row>
    </RowContainer>
  );
}

const RowContainer = styled('div')<{incompatible?: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
  border-color: ${p => (p.incompatible ? p.theme.red200 : 'none')};
`;

const Row = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
`;

const Rule = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
  opacity: 0;

  ${RowContainer}:hover &,
  ${RowContainer}:focus-within &,
  &:focus {
    opacity: 1;
  }
`;

export const InlineInputField = styled(InputField)`
  padding: 0;
  width: 180px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;

export const InlineNumberInput = styled(NumberField)`
  padding: 0;
  width: 90px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;

export const InlineSelectControl = styled(SelectField)`
  width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
`;

export const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '28px',
    height: '28px',
    padding: 0,
  }),
};
