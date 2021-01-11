import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {ImageProcessingInfo} from 'app/types/debugImage';

type Props = {
  status: ImageProcessingInfo;
};

function Status({status}: Props) {
  switch (status) {
    case ImageProcessingInfo.OTHER:
    case ImageProcessingInfo.FETCHING_FAILED:
    case ImageProcessingInfo.MALFORMED:
    case ImageProcessingInfo.TIMEOUT: {
      return <StyledTag type="error">{t('Error')}</StyledTag>;
    }
    case ImageProcessingInfo.MISSING: {
      return <StyledTag type="error">{t('Missing')}</StyledTag>;
    }
    case ImageProcessingInfo.FOUND: {
      return <StyledTag type="success">{t('Ok')}</StyledTag>;
    }
    case ImageProcessingInfo.UNUSED: {
      return <StyledTag>{t('Unreferenced')}</StyledTag>;
    }
    default:
      return <StyledTag>{t('Unknown')}</StyledTag>; // This should not happen
  }
}

export default Status;

const StyledTag = styled(Tag)`
  &,
  span div {
    max-width: 100%;
  }
`;
