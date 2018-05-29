import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import Hovercard from 'app/components/hovercard';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';

class ExceptionMechanism extends React.Component {
  static propTypes = {
    data: PropTypes.shape({
      type: PropTypes.string.isRequired,
      description: PropTypes.string,
      help_link: PropTypes.string,
      handled: PropTypes.bool,
      meta: PropTypes.shape({
        errno: PropTypes.shape({
          number: PropTypes.number.isRequired,
          name: PropTypes.string,
        }),
        mach_exception: PropTypes.shape({
          exception: PropTypes.number.isRequired,
          code: PropTypes.number.isRequired,
          subcode: PropTypes.number.isRequired,
          name: PropTypes.string,
        }),
        signal: PropTypes.shape({
          number: PropTypes.number.isRequired,
          code: PropTypes.nubmer,
          name: PropTypes.string,
          code_name: PropTypes.string,
        }),
      }),
      data: PropTypes.object,
    }).isRequired,
  };

  render() {
    let mechanism = this.props.data;
    let {type, description, help_link, handled, meta = {}, data = {}} = mechanism;
    let {errno, signal, mach_exception} = meta;

    let linkElement = help_link && (
      <a href={help_link} className="external-icon">
        <em className="icon-open" />
      </a>
    );

    let descriptionElement = description && (
      <Hovercard
        header={
          <span>
            {t('Details')} {linkElement}
          </span>
        }
        body={description}
        containerClassName="pill-icon"
      >
        <InlineSvg src="icon-circle-info" size="14px" />
      </Hovercard>
    );

    let pills = [
      <Pill key="mechanism" name="mechanism" value={type}>
        {descriptionElement || linkElement}
      </Pill>,
    ];

    if (!_.isNil(handled)) {
      pills.push(<Pill key="handled" name="handled" value={handled} />);
    }

    if (errno) {
      let value = errno.name || errno.number;
      pills.push(<Pill key="errno" name="errno" value={value} />);
    }

    if (mach_exception) {
      let value = mach_exception.name || mach_exception.exception;
      pills.push(<Pill key="mach" name="mach exception" value={value} />);
    }

    if (signal) {
      let code = signal.code_name || `${t('code')} ${signal.code}`;
      let name = signal.name || signal.number;
      let value = _.isNil(signal.code) ? name : `${name} (${code})`;
      pills.push(<Pill key="signal" name="signal" value={value} />);
    }

    _.forOwn(data, (value, key) => {
      if (!_.isObject(value)) {
        pills.push(<Pill key={`data:${key}`} name={key} value={value} />);
      }
    });

    return (
      <div className="exception-mechanism">
        <Pills>{pills}</Pills>
      </div>
    );
  }
}

export default ExceptionMechanism;
