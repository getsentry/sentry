import Hotkeys from 'sentry/components/hotkeys';

export default {
  title: 'Components/Hotkeys',
  argTypes: {
    platform: {
      options: ['macos', 'generic'],
      control: {type: 'radio'},
    },
  },
  component: Hotkeys,
};

export const Default = args => (
  <div>
    <Hotkeys value={['command+option+a', 'ctrl+alt+a']} forcePlatform={args.platform} />
    <Hotkeys value="shift+!" forcePlatform={args.platform} />
    <Hotkeys value="ctrl+alt+delete" forcePlatform={args.platform} />
    <Hotkeys value="fn+backspace" forcePlatform={args.platform} />
    <Hotkeys value="left+right+up+down" forcePlatform={args.platform} />
    <Hotkeys value={['command+space', 'alt+space']} forcePlatform={args.platform} />
    <Hotkeys value=";+:+[+]" forcePlatform={args.platform} />
    <Hotkeys value="command+\+" forcePlatform={args.platform} />
    Fallback to entirely different key combination:
    <Hotkeys value={['command+control', 'alt']} forcePlatform={args.platform} />
    No fallback for windows
    <Hotkeys value={['command+option']} forcePlatform={args.platform} />
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
