import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Tag} from 'sentry/components/core/badge/tag';
import {t} from 'sentry/locale';
import {ImageStatus} from 'sentry/types/debugImage';

type Props = {
  status: ImageStatus;
};

function Status({status}: Props) {
  switch (status) {
    case ImageStatus.OTHER:
    case ImageStatus.FETCHING_FAILED:
    case ImageStatus.MALFORMED:
    case ImageStatus.TIMEOUT: {
      return <StyledTag type="error">{t('Error')}</StyledTag>;
    }
    case ImageStatus.MISSING: {
      return <StyledTag type="error">{t('Missing')}</StyledTag>;
    }
    case ImageStatus.FOUND: {
      return <StyledTag type="success">{t('Ok')}</StyledTag>;
    }
    case ImageStatus.UNUSED: {
      return <StyledTag>{t('Unreferenced')}</StyledTag>;
    }
    default: {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureException(new Error('Unknown image status'));
      });
      return <StyledTag>{t('Unknown')}</StyledTag>; // This shall not happen
    }
  }
}

export default Status;

const StyledTag = styled(Tag)`
  max-width: 100%;
`;
