import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import Alert, {Props as AlertProps} from 'app/components/alert';

type Props = {
  type?: AlertProps['type'];
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
