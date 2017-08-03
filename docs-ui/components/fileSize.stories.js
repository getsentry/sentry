import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import FileSize from 'sentry-ui/fileSize';
import Duration from 'sentry-ui/duration';
import DateTime from 'sentry-ui/dateTime';
import Count from 'sentry-ui/count';

storiesOf('Formatters')
  .addWithInfo(
    'DateTime',
    'Formats number (in ms or seconds) into a datetime string',
    () => (
      <div>
        <div>
          <DateTime />
        </div>
        <div>
          <DateTime date={1500000000000} />
        </div>
        <div>
          <DateTime seconds={false} date={1500000000000} />
        </div>
      </div>
    )
  )
  .addWithInfo('FileSize', 'Formats number of bytes to filesize string', () => (
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
  .addWithInfo('Duration', 'Formats number of seconds into a duration string', () => (
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
  .addWithInfo('Count', 'Formats numbers into a shorthand string', () => (
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
  ));
