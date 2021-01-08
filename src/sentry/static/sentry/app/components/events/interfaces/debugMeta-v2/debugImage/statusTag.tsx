import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {Image, ImageProcessingInfo} from 'app/types/debugImage';

import {combineStatus} from '../utils';

type Props = {
  image: Image;
};

function StatusTag({image}: Props) {
  const {debug_status, unwind_status} = image;
  const status = combineStatus(debug_status, unwind_status);

  switch (status) {
    case ImageProcessingInfo.OTHER:
    case ImageProcessingInfo.FETCHING_FAILED:
    case ImageProcessingInfo.MALFORMED:
    case ImageProcessingInfo.TIMEOUT: {
      return <StyledTag type="warning">{t('Problem')}</StyledTag>;
    }
    case ImageProcessingInfo.MISSING: {
      return <StyledTag type="error">{t('Missing')}</StyledTag>;
    }
    case ImageProcessingInfo.FOUND: {
      return <StyledTag type="success">{t('Success')}</StyledTag>;
    }
    case ImageProcessingInfo.UNUSED: {
      return <StyledTag>{t('Unreferenced')}</StyledTag>;
    }
    default:
      return <StyledTag>{t('Unknown')}</StyledTag>; // This should not happen
  }
}

export default StatusTag;

const StyledTag = styled(Tag)`
  &,
  span div {
    max-width: 100%;
  }
`;
