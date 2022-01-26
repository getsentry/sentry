import {Hovercard} from 'sentry/components/hovercard';

export default {
  title: 'Components/Tooltips/Hovercard',
  component: Hovercard,
  args: {
    header: 'Header',
    body: 'Body',
    position: 'top',
  },
  argTypes: {
    tipColor: {control: 'color'},
    show: {
      type: 'select',
      options: [undefined, false, true],
    },
  },
};

export const _Hovercard = ({...args}) => (
  <div
    style={{
      height: 300,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Hovercard {...args}>Hover over me</Hovercard>
  </div>
);

_Hovercard.parameters = {
  docs: {
    description: {
      story:
        'Good luck if your container element is near the top and/or left side of the screen',
    },
  },
};
