import TextOverflow from 'sentry/components/textOverflow';

export default {
  title: 'Utilities/Text/Overflow',
  args: {
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

export const _TextOverflow = ({...args}) => (
  <div style={{width: 50}}>
    <TextOverflow {...args}>AReallyLongTextString</TextOverflow>
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
