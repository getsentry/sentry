import React from 'react';
import {action} from '@storybook/addon-actions';

import Button from 'app/components/button';
import GlobalModal from 'app/components/globalModal';
import FeatureTourModal from 'app/components/modals/featureTourModal';
import {IconEdit} from 'app/icons';

export default {
  title: 'Layouts/Modals',
  component: FeatureTourModal,
};

const steps = [
  {
    title: 'How to draw an owl',
    body: <p>First get all your sketchbook and pencil.</p>,
  },
  {
    title: 'Draw two circles',
    body: 'Next, draw a circle for the head, and another for the body.',
    actions: <Button>Read docs</Button>,
  },
  {
    image: <IconEdit size="xl" />,
    title: 'Draw the rest of the owl',
    body: 'Finish off the drawing by adding eyes, feathers and talons.',
  },
  {
    title: 'All done!',
    body: 'Great job on drawing your owl.',
  },
];

export const FeatureTourModalBasics = () => (
  <div className="section">
    <GlobalModal />
    <FeatureTourModal
      steps={steps}
      onAdvance={action('onAdvance')}
      onCloseModal={action('onCloseModal')}
    >
      {({showModal}) => <Button onClick={showModal}>Show tour</Button>}
    </FeatureTourModal>
  </div>
);

FeatureTourModalBasics.storyName = 'FeatureTourModal';
FeatureTourModalBasics.parameters = {
  docs: {
    description: {
      story: 'A feature tour with multiple steps',
    },
  },
};
