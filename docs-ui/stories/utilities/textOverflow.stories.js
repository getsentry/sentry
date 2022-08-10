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

export const TestCases = () => {
  const examples = [
    {
      width: 250,
      text: 'https://example.com/foo/',
      isParagraph: false,
      ellipsisDirection: 'right',
    },
    {
      width: 250,
      text: 'https://example.com/foo/',
      isParagraph: false,
      ellipsisDirection: 'left',
    },
    {
      width: 150,
      text: 'https://example.com/foo/',
      isParagraph: false,
      ellipsisDirection: 'right',
    },
    {
      width: 150,
      text: 'https://example.com/foo/',
      isParagraph: false,
      ellipsisDirection: 'left',
    },
    {
      width: 75,
      text: 'Hello world',
      isParagraph: false,
      ellipsisDirection: 'right',
    },
    {
      width: 75,
      text: 'Hello world',
      isParagraph: false,
      ellipsisDirection: 'left',
    },
  ];

  return (
    <div>
      {examples.map((props, i) => (
        <_TextOverflow key={i} {...props} />
      ))}
    </div>
  );
};
