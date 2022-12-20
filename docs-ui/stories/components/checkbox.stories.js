import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';

export default {
  title: 'Components/Forms/Controls/Checkbox',
  component: Checkbox,
  args: {
    size: 'md',
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
    checked: {
      control: {type: 'boolean'},
    },
  },
};

export const Default = props => (
  <div>
    <Checkbox {...props} />
  </div>
);

export const WithLabel = props => (
  <div>
    <Label>
      Label to left
      <Checkbox {...props} />
    </Label>
    <Label>
      <Checkbox {...props} />
      Label to right
    </Label>
  </div>
);

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
`;
