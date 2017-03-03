import React from 'react';

import EventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import utils from '../../../utils';
import {t} from '../../../locale';

const MessageInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    return (
      <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="message"
          title={t('Message')}>
        <pre className="plain" dangerouslySetInnerHTML={{
          __html: utils.nl2br(utils.urlize(utils.escape(data.formatted || data.message)))
        }} />
        {data.params && !data.formatted &&
          <div>
            <h5>{t('Params')}</h5>
            <pre className="plain">{JSON.stringify(data.params, null, 2)}</pre>
          </div>
        }
      </EventDataSection>
    );
  }
});

export default MessageInterface;
