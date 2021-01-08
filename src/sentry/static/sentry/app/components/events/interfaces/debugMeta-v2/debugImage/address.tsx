import React from 'react';

import {DebugImage} from 'app/components/events/interfaces/debugMeta/types';
import {formatAddress, getImageRange} from 'app/components/events/interfaces/utils';
import {Image} from 'app/types/debugImage';

const IMAGE_ADDR_LEN = 12;

type Props = {
  image: Image;
};

function Address({image}: Props) {
  const [startAddress, endAddress] = getImageRange(image as DebugImage);

  if (startAddress && endAddress) {
    return (
      <React.Fragment>
        <span>{formatAddress(startAddress, IMAGE_ADDR_LEN)}</span>
        {' \u2013 '}
        <span>{formatAddress(endAddress, IMAGE_ADDR_LEN)}</span>
      </React.Fragment>
    );
  }

  return null;
}

export default Address;
