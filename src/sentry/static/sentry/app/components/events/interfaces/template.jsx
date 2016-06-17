import React from 'react';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import Frame from './frame';
import {t} from '../../../locale';

const TemplateInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired
  },

  getInitialState() {
    return {};
  },

  render() {
    return (
      <GroupEventDataSection
        group={this.props.group}
        event={this.props.event}
        type={this.props.type}
        title={<div>{t('Template')}</div>}>
        <div className="traceback no-exception">
          <ul>
            <Frame data={this.props.data} isExpanded={true}/>
          </ul>
        </div>
      </GroupEventDataSection>
    );
  }
});

export default TemplateInterface;
