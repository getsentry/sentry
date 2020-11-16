import React from 'react';

import {t} from 'app/locale';
import {IconAdd} from 'app/icons';
import Button from 'app/components/button';

class Controls extends React.Component {
  render() {
    return (
      <Button
        onClick={e => {
          e.preventDefault();

          console.log('create dashboard');
        }}
        priority="primary"
        href="#create-dashboard"
        icon={<IconAdd size="xs" isCircled />}
        size="small"
      >
        {t('Create Dashboard')}
      </Button>
    );
  }
}

export default Controls;
