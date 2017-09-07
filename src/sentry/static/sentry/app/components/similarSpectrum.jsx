import React from 'react';
import classNames from 'classnames';

import {t} from '../locale';
import '../../less/components/similarSpectrum.less';

const SimilarSpectrum = React.createClass({
  propTypes: {},

  getDefaultProps() {
    return {};
  },

  getInitialState() {
    return {};
  },

  render() {
    let {className} = this.props;
    let cx = classNames('similar-spectrum', className);

    return (
      <div className={cx}>
        <span>
          {t('Similar')}
        </span>
        <span className="similar-spectrum-box high" />
        <span className="similar-spectrum-box med-high" />
        <span className="similar-spectrum-box med" />
        <span className="similar-spectrum-box low-med" />
        <span className="similar-spectrum-box low" />
        <span>
          {t('Not Similar')}
        </span>
      </div>
    );
  }
});

export default SimilarSpectrum;
