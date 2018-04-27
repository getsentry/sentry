import React from 'react';
import classNames from 'classnames';

import {t} from 'app/locale';
import 'app/../less/components/similarSpectrum.less';

class SimilarSpectrum extends React.Component {
  static propTypes = {};
  static defaultProps = {};

  render() {
    let {className} = this.props;
    let cx = classNames('similar-spectrum', className);

    return (
      <div className={cx}>
        <span>{t('Similar')}</span>
        <span className="similar-spectrum-box high" />
        <span className="similar-spectrum-box med-high" />
        <span className="similar-spectrum-box med" />
        <span className="similar-spectrum-box low-med" />
        <span className="similar-spectrum-box low" />
        <span>{t('Not Similar')}</span>
      </div>
    );
  }
}

export default SimilarSpectrum;
