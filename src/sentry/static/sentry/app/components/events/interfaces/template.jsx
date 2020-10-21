import PropTypes from 'prop-types';
import {Component} from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import Line from 'app/components/events/interfaces/frame/line';
import {t} from 'app/locale';

class TemplateInterface extends Component {
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
            <Line data={this.props.data} isExpanded />
          </ul>
        </div>
      </EventDataSection>
    );
  }
}

export default TemplateInterface;
