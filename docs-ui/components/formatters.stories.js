import React from 'react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';
import {text, boolean} from '@storybook/addon-knobs';

import FileSize from 'app/components/fileSize';
import Duration from 'app/components/duration';
import DateTime from 'app/components/dateTime';
import Count from 'app/components/count';
import Version from 'app/components/version';

export default {
  title: 'Utility/Formatters',
};

export const _DateTime = withInfo(
  'Formats number (in ms or seconds) into a datetime string'
)(() => (
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

    <div>
      <DateTime timeOnly date={1500000000000} />
    </div>
  </div>
));

_DateTime.story = {
  name: 'DateTime',
};

export const _FileSize = withInfo('Formats number of bytes to filesize string')(() => (
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
));

_FileSize.story = {
  name: 'FileSize',
};

export const _Duration = withInfo('Formats number of seconds into a duration string')(
  () => {
    const exact = boolean('exact', false);
    const abbreviation = boolean('abbreviation', false);
    return (
      <div>
        <div>
          <Duration seconds={15} exact={exact} abbreviation={abbreviation} />
        </div>
        <div>
          <Duration seconds={60} exact={exact} abbreviation={abbreviation} />
        </div>
        <div>
          <Duration seconds={15000} exact={exact} abbreviation={abbreviation} />
        </div>
        <div>
          <Duration seconds={86400} exact={exact} abbreviation={abbreviation} />
        </div>
        <div>
          <Duration seconds={186400} exact={exact} abbreviation={abbreviation} />
        </div>
        <div>
          <Duration seconds={604800} exact={exact} abbreviation={abbreviation} />
        </div>
        <div>
          <Duration seconds={1500000} exact={exact} abbreviation={abbreviation} />
        </div>
      </div>
    );
  }
);

export const _Count = withInfo('Formats numbers into a shorthand string')(() => (
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

export const _Version = withInfo('Formats release version')(() => {
  const version = text('version', 'foo.bar.Baz@1.0.0+20200101');
  const anchor = boolean('anchor', true);
  const preserveGlobalSelection = boolean('preserveGlobalSelection', false);
  const tooltipRawVersion = boolean('tooltipRawVersion', true);
  const withPackage = boolean('withPackage', false);
  const truncate = boolean('truncate', false);
  const projectId = text('projectId', '');
  const className = text('className', 'asdsad');
  return (
    <div>
      {version} =
      <Version
        version={version}
        anchor={anchor}
        preserveGlobalSelection={preserveGlobalSelection}
        tooltipRawVersion={tooltipRawVersion}
        withPackage={withPackage}
        projectId={projectId}
        truncate={truncate}
        className={className}
      />
    </div>
  );
});
