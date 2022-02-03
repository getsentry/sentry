import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import FileSize from 'sentry/components/fileSize';
import Version from 'sentry/components/version';

export default {
  title: 'Utilities/Text/Formatters',
};

export const _DateTime = () => (
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
);

_DateTime.storyName = 'DateTime';
_DateTime.parameters = {
  docs: {
    description: {
      story: 'Formats number (in ms or seconds) into a datetime string',
    },
  },
};

export const _FileSize = () => (
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
);

_FileSize.storyName = 'FileSize';
_FileSize.parameters = {
  docs: {
    description: {
      story: 'Formats number of bytes to filesize string',
    },
  },
};

export const _Duration = ({exact, abbreviation}) => {
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
};
_Duration.args = {
  exact: false,
  abbreviation: false,
};
_Duration.parameters = {
  docs: {
    description: {
      story: 'Formats number of seconds into a duration string',
    },
  },
};

export const _Count = () => (
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
);
_Count.parameters = {
  docs: {
    description: {
      story: 'Formats numbers into a shorthand string',
    },
  },
};

export const _Version = ({
  version,
  anchor,
  preservePageFilters,
  tooltipRawVersion,
  withPackage,
  projectId,
  truncate,
  className,
}) => {
  return (
    <div>
      {version} =
      <Version
        version={version}
        anchor={anchor}
        preservePageFilters={preservePageFilters}
        tooltipRawVersion={tooltipRawVersion}
        withPackage={withPackage}
        projectId={projectId}
        truncate={truncate}
        className={className}
      />
    </div>
  );
};
_Version.args = {
  version: 'foo.bar.Baz@1.0.0+20200101',
  anchor: true,
  preservePageFilters: false,
  tooltipRawVersion: true,
  withPackage: false,
  projectId: '',
  truncate: false,
  className: 'asdsad',
};
_Version.parameters = {
  docs: {
    description: {
      story: 'Formats release version',
    },
  },
};
