import Highlight, {HighlightComponent} from 'sentry/components/highlight';

export default {
  title: 'Utilities/Highlight',
  component: HighlightComponent,
  args: {
    text: 'ILL',
  },
  argTypes: {
    children: {
      table: {
        disable: true,
      },
    },
  },
};

export const HighlightASubstring = ({...args}) => (
  <Highlight {...args}>billy@sentry.io</Highlight>
);

HighlightASubstring.storyName = 'Substring';
