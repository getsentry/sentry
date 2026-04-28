import {Fragment} from 'react';

import {FileSize} from 'sentry/components/fileSize';

interface Props {
  bytes?: number;
}

export function ResourceSize(props: Props) {
  const {bytes} = props;
  if (!bytes) {
    return <Fragment>--</Fragment>;
  }

  return <FileSize bytes={bytes} />;
}
