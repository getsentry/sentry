import React, {Component} from 'react';
import {t} from 'app/locale';

export default class PreviewFeature extends Component {
  render() {
    return (
      <div className="alert alert-block alert-warn">
        {t(
          'This feature is a preview and may change in the future. Thanks for being an early adopter!'
        )}
      </div>
    );
  }
}
