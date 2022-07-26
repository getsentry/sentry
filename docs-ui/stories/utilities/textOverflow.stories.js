import TextOverflow from 'sentry/components/textOverflow';

export default {
  title: 'Utilities/Text/Overflow',
  args: {
    width: 150,
    text: 'https://example.com/foo/',
    isParagraph: false,
    ellipsisDirection: 'right',
  },
  argTypes: {
    ellipsisDirection: {
      control: {
        type: 'select',
        options: ['left', 'right'],
      },
    },
  },
};

export const _TextOverflow = ({text, width, ...args}) => (
  <div style={{width}}>
    <TextOverflow {...args}>{text}</TextOverflow>
  </div>
);

_TextOverflow.storyName = 'Overflow';
_TextOverflow.parameters = {
  docs: {
    description: {
      story:
        'Simple component that adds "text-overflow: ellipsis" and "overflow: hidden", still depends on container styles',
    },
  },
};
