import HotkeysLabel from 'sentry/components/hotkeysLabel';

export default {
  title: 'Components/HotkeysLabel',
  argTypes: {
    platform: {
      options: ['macos', 'generic'],
      control: {type: 'radio'},
    },
  },
  component: HotkeysLabel,
};

export const Default = args => (
  <div>
    <HotkeysLabel
      value={['command+option+a', 'ctrl+alt+a']}
      forcePlatform={args.platform}
    />
    <HotkeysLabel value="shift+!" forcePlatform={args.platform} />
    <HotkeysLabel value="ctrl+alt+delete" forcePlatform={args.platform} />
    <HotkeysLabel value="fn+backspace" forcePlatform={args.platform} />
    <HotkeysLabel value="left+right+up+down" forcePlatform={args.platform} />
    <HotkeysLabel value={['command+space', 'alt+space']} forcePlatform={args.platform} />
    <HotkeysLabel value=";+:+[+]" forcePlatform={args.platform} />
    <HotkeysLabel value="command+\+" forcePlatform={args.platform} />
    Fallback to entirely different key combination:
    <HotkeysLabel value={['command+control', 'alt']} forcePlatform={args.platform} />
    No fallback for windows
    <HotkeysLabel value={['command+option']} forcePlatform={args.platform} />
  </div>
);

Default.args = {
  platform: 'macos',
};

Default.storyName = 'HotkeysLabel';
Default.parameters = {
  docs: {
    description: {
      story: 'Render some cool keyboard keys',
    },
  },
};
