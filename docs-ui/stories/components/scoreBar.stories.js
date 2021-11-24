import ScoreBar from 'sentry/components/scoreBar';

export default {
  title: 'Components/Data Visualization/Score Bar',
  args: {
    vertical: false,
    size: 40,
    thickness: 4,
    score: 3,
  },
};

const Template = ({...args}) => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <ScoreBar {...args} />
  </div>
);

export const Horizontal = Template.bind({});
Horizontal.storyName = 'Horizontal';

export const Vertical = Template.bind({});
Vertical.args = {vertical: true};
Vertical.storyName = 'Vertical';

export const CustomPalette = Template.bind({});
CustomPalette.storyName = 'Custom Palette';
CustomPalette.args = {
  palette: ['pink', 'yellow', 'lime', 'blue', 'purple'],
};
