import React from 'react';
import ConfigStore from '../../../stores/configStore';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import rawStacktraceContent from './rawStacktraceContent';
import StacktraceContent from './stacktraceContent';
import {t} from '../../../locale';


const StacktraceInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string
  },

  getInitialState() {
    let user = ConfigStore.get('user');
    // user may not be authenticated
    let options = user ? user.options : {};
    let platform = this.props.event.platform;
    let newestFirst;
    switch (options.stacktraceOrder) {
      case 'newestFirst':
        newestFirst = true;
        break;
      case 'newestLast':
        newestFirst = false;
        break;
      case 'default': // is "default" a valid value? or bad case statement
      default:
        newestFirst = (platform === 'python');
    }

    return {
      stackView: (this.props.data.hasSystemFrames ? 'app' : 'full'),
      newestFirst: newestFirst
    };
  },

  toggleStack(value) {
    this.setState({
      stackView: value
    });
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let data = this.props.data;
    let stackView = this.state.stackView;
    let newestFirst = this.state.newestFirst;

    let title = (
      <div>
        <div className="btn-group">
          {data.hasSystemFrames &&
            <a className={(stackView === 'app' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleStack.bind(this, 'app')}>{t('App Only')}</a>
          }
          <a className={(stackView === 'full' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleStack.bind(this, 'full')}>{t('Full')}</a>
          <a className={(stackView === 'raw' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleStack.bind(this, 'raw')}>{t('Raw')}</a>
        </div>
        <h3>
          {'Stacktrace '}
          {newestFirst ?
            <small>({t('most recent call last')})</small>
          :
            <small>({t('most recent call first')})</small>
          }
        </h3>
      </div>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        {stackView === 'raw' ?
          <pre className="traceback plain">
            {rawStacktraceContent(data, this.props.platform)}
          </pre>
        :
          <StacktraceContent
              data={data}
              includeSystemFrames={stackView === 'full'}
              platform={evt.platform}
              newestFirst={newestFirst} />
        }
      </GroupEventDataSection>
    );
  }
});

export default StacktraceInterface;
