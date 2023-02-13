import styled from '@emotion/styled';
import {useArgs} from '@storybook/client-api';

import Checkbox from 'sentry/components/checkbox';

export default {
  title: 'Components/Forms/Controls/Checkbox',
  component: Checkbox,
  args: {
    size: 'sm',
    disabled: false,
    checked: true,
  },
  argTypes: {
    size: {
      options: ['xs', 'sm', 'md'],
      control: {type: 'radio'},
    },
    disabled: {
      control: {type: 'boolean'},
    },
  },
};

export const Default = props => {
  const [_, updateArgs] = useArgs();

  return (
    <div>
      <Checkbox {...props} onChange={e => updateArgs({checked: !!e.target.checked})} />
    </div>
  );
};

export const WithLabel = props => {
  const [_, updateArgs] = useArgs();

  return (
    <Label>
      <Checkbox {...props} onChange={e => updateArgs({checked: !!e.target.checked})} />
      Label
    </Label>
  );
};

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
`;
