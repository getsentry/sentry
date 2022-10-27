import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {
  Input,
  InputGroup,
  InputLeadingItems,
  InputTrailingItems,
} from 'sentry/components/inputGroup';
import {IconClose} from 'sentry/icons/iconClose';
import {IconSearch} from 'sentry/icons/iconSearch';
import space from 'sentry/styles/space';

export default {
  title: 'Components/Input Group',
  args: {
    size: 'md',
    disabled: false,
    monospace: false,
    readOnly: false,
    placeholder: 'Search…',
  },
  argTypes: {
    size: {
      options: ['md', 'sm', 'xs'],
      control: {type: 'inline-radio'},
    },
  },
};

export const _Default = ({...args}) => {
  return (
    <InputGroup>
      <InputLeadingItems disablePointerEvents>
        <IconSearch size="sm" color="subText" />
      </InputLeadingItems>
      <Input {...args} />
      <InputTrailingItems>
        <StyledButton borderless>
          <IconClose size="xs" color="subText" />
        </StyledButton>
      </InputTrailingItems>
    </InputGroup>
  );
};

const StyledButton = styled(Button)`
  color: ${p => p.theme.subText};
  padding: ${space(0.5)};
  min-height: 0;
  height: auto;
`;
