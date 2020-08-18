import React from 'react';
import {withInfo} from '@storybook/addon-info';

import Button from 'app/components/button';
import FeatureTourModal from 'app/components/modals/featureTourModal';

export default {
  title: 'UI/Modals',
};

export const Basics = withInfo('A feature tour with multiple steps')(() => (
  <div className="section">
    <FeatureTourModal>
      {({handleShow}) => <Button onClick={handleShow}>Show tour</Button>}
    </FeatureTourModal>
  </div>
));

Basics.story = {
  name: 'Basics',
};
