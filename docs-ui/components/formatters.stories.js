import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import FileSize from 'app/components/fileSize';
import Duration from 'app/components/duration';
import DateTime from 'app/components/dateTime';
import Count from 'app/components/count';

storiesOf('Formatters', module)
  .add(
    'DateTime',
    withInfo('Formats number (in ms or seconds) into a datetime string')(() => (
      <div>
        <div>
          <DateTime date={1500000000000} />
        </div>
        <div>
          <DateTime seconds={false} date={1500000000000} />
        </div>
        <div>
          <DateTime dateOnly date={1500000000000} />
        </div>
      </div>
    ))
  )
  .add(
    'FileSize',
    withInfo('Formats number of bytes to filesize string')(() => (
      <div>
        <div>
          <FileSize bytes={15} />
        </div>
        <div>
          <FileSize bytes={15000} />
        </div>
        <div>
          <FileSize bytes={1500000} />
        </div>
        <div>
          <FileSize bytes={15000000000} />
        </div>
        <div>
          <FileSize bytes={15000000000000} />
        </div>
        <div>
          <FileSize bytes={15000000000000000} />
        </div>
      </div>
    ))
  )
  .add(
    'Duration',
    withInfo('Formats number of seconds into a duration string')(() => (
      <div>
        <div>
          <Duration seconds={15} />
        </div>
        <div>
          <Duration seconds={60} />
        </div>
        <div>
          <Duration seconds={15000} />
        </div>
        <div>
          <Duration seconds={86400} />
        </div>
        <div>
          <Duration seconds={186400} />
        </div>
        <div>
          <Duration seconds={604800} />
        </div>
        <div>
          <Duration seconds={1500000} />
        </div>
      </div>
    ))
  )
  .add(
    'Count',
    withInfo('Formats numbers into a shorthand string')(() => (
      <div>
        <div>
          5000000 =
          <Count value="5000000" />
        </div>
        <div>
          500000000 =
          <Count value="500000000" />
        </div>
        <div>
          50000 =
          <Count value="50000" />
        </div>
      </div>
    ))
  );
