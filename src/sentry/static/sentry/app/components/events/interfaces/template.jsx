import PropTypes from 'prop-types';
import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import FrameLine from 'app/components/events/interfaces/frame/frameLine';
import {t} from 'app/locale';

class TemplateInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  render() {
    return (
      <EventDataSection
        event={this.props.event}
        type={this.props.type}
        title={<div>{t('Template')}</div>}
      >
        <div className="traceback no-exception">
          <ul>
            <FrameLine data={this.props.data} isExpanded />
          </ul>
        </div>
      </EventDataSection>
    );
  }
}

export default TemplateInterface;
