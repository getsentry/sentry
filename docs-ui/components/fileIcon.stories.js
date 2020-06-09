import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {text} from '@storybook/addon-knobs';

import FileIcon from 'app/components/fileIcon';

storiesOf('Style|Icons', module).add(
  'FileIcon',
  withInfo('Shows a platform icon for given filename - based on extension')(() => {
    const fileName = text('fileName', 'src/components/testComponent.tsx');
    const size = text('size', 'xl');

    return (
      <div>
        <FileIcon fileName={fileName} size={size} />
      </div>
    );
  })
);
