import {Fragment} from 'react';

import FileSize from 'sentry/components/fileSize';

type Props = {
  bytes: number;
};

function ResourceSize(props: Props) {
  const {bytes} = props;
  if (bytes === 0) {
    return <Fragment>--</Fragment>;
  }

  return <FileSize bytes={bytes} />;
}

export default ResourceSize;
