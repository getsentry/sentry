import Hotkeys from 'sentry/components/hotkeys';

export default {
  title: 'Components/Hotkeys',
  argTypes: {
    platform: {
      options: ['macos', 'other'],
      control: {type: 'radio'},
    },
  },
  component: Hotkeys,
};

export const Default = args => (
  <div>
    <Hotkeys value="command+option+a,ctrl+alt+a" platform={args.platform} />
    <Hotkeys value="shift+!" platform={args.platform} />
    <Hotkeys value="ctrl+alt+delete" platform={args.platform} />
    <Hotkeys value="fn+backspace" platform={args.platform} />
    <Hotkeys value="left+right+up+down" platform={args.platform} />
    <Hotkeys value="command+space,alt+space" platform={args.platform} />
    <Hotkeys value=";+:+[+]" platform={args.platform} />
    <Hotkeys value="command+\+" platform={args.platform} />
    Fallback to entirely different key combination:
    <Hotkeys value="command+command,alt" platform={args.platform} />
  </div>
);

Default.args = {
  platform: 'macos',
};

Default.storyName = 'Hotkeys';
Default.parameters = {
  docs: {
    description: {
      story: 'Render some cool keyboard keys',
    },
  },
};
