import React from 'react';
import {t} from 'app/locale';
import PropTypes from 'prop-types';

import Alert from './alert';

type Props = {
  type?: 'success' | 'error' | 'warning' | 'info';
};

const PreviewFeature: React.FC<Props> = ({type = 'info'}) => {
  return (
    <Alert type={type} icon="icon-labs">
      {t(
        'This feature is a preview and may change in the future. Thanks for being an early adopter!'
      )}
    </Alert>
  );
};

PreviewFeature.propTypes = {
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
};

export default PreviewFeature;
