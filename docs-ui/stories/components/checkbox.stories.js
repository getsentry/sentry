import {useState} from 'react';
import styled from '@emotion/styled';

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
  const [checked, setChecked] = useState(true);

  return (
    <div>
      <Checkbox
        {...props}
        checked={checked}
        onChange={e => setChecked(e.target.checked)}
      />
    </div>
  );
};

export const WithLabel = props => {
  const [check1, setCheck1] = useState(true);
  const [check2, setCheck2] = useState(false);

  return (
    <div>
      <Label>
        Label to left
        <Checkbox
          {...props}
          checked={check1}
          onChange={e => setCheck1(e.target.checked)}
        />
      </Label>
      <Label>
        <Checkbox
          {...props}
          checked={check2}
          onChange={e => setCheck2(e.target.checked)}
        />
        Label to right
      </Label>
    </div>
  );
};

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
`;
