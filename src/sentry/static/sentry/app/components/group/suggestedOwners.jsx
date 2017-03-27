import React from 'react';

import Avatar from '../Avatar';
import TooltipMixin from '../../mixins/tooltip';
import {t} from '../../locale';

const SuggestedOwners = React.createClass({
  mixins: [
    TooltipMixin({
      html: true,
      selector: '.tip',
      container: 'body'
    })
  ],
  render() {
    return(
      <div className="m-b-1">
        <h6><span>{t('Suggested Owners')}</span></h6>

        <div className="avatar-grid">
          <span className="avatar-grid-item tip"
               title="<div><strong>Click to assign dcramer</strong></div> <small>Reason: Last touched 1 day ago</small>">
            <Avatar user={1}/>
          </span>
          <span className="avatar-grid-item tip"
               title="Reason: ">
            <Avatar user={1}/>
          </span>
          <span className="avatar-grid-item tip"
               title="Reason: ">
            <Avatar user={1}/>
          </span>
        </div>
      </div>
    );
  }
});

export default SuggestedOwners;
