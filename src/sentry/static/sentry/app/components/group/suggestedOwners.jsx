import React from 'react';
import ReactDOMServer from 'react-dom/server';
import moment from 'moment';

import Avatar from '../avatar';
import TooltipMixin from '../../mixins/tooltip';
import ApiMixin from '../../mixins/apiMixin';
import GroupState from '../../mixins/groupState';
import {t} from '../../locale';

const SuggestedOwners = React.createClass({
  propTypes: {
    event: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    GroupState,
    TooltipMixin({
      selector: '.tip',
      html: true,
      container: 'body',
      template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner tooltip-owners"></div></div>'
    })
  ],

  getInitialState() {
    return {owners: undefined};
  },

  componentDidMount() {
    this.fetchData(this.props.event);
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.event && nextProps.event) {
      if (this.props.event.id !== nextProps.event.id) {
        //two events, with different IDs
        this.fetchData(nextProps.event);
      }
    } else if (nextProps.event) {
      //going from having no event to having an event
      this.fetchData(nextProps.event);
    }
  },

  componentDidUpdate(_, nextState) {
    //this shallow equality should be OK because it's being mutated fetchData as a new object
    if (this.state.owners !== nextState.owners) {
      this.removeTooltips();
      this.attachTooltips();
    }
  },

  fetchData(event) {
    if (!event) return;
    let org = this.getOrganization();
    let project = this.getProject();
    this.api.request(
      `/projects/${org.slug}/${project.slug}/events/${event.id}/committers/`,
      {
        success: (data, _, jqXHR) => {
          this.setState({
            owners: data.committers
          });
        },
        error: error => {
          this.setState({
            owners: undefined
          });
        }
      }
    );
  },

  assignTo(member) {
    if (member.id !== undefined) {
      this.api.assignTo({id: this.props.event.groupID, member: member});
    }
  },

  renderCommitter({author, commits}) {
    return (
      <span
        key={author.id || author.email}
        className="avatar-grid-item tip"
        onClick={() => this.assignTo(author)}
        title={ReactDOMServer.renderToStaticMarkup(
          <div>
            {author.id
              ? <div className="tooltip-owners-name">
                  {author.name}
                </div>
              : <div className="tooltip-owners-unknown">
                  <p className="tooltip-owners-unknown-email">
                    <span className="icon icon-circle-cross" />
                    <strong>{author.email}</strong>
                  </p>
                  <p>
                    Sorry, we don't recognize this member. Make sure to link alternative emails in Account Settings.
                  </p>
                  <hr />
                </div>}
            <ul className="tooltip-owners-commits">
              {commits.slice(0, 6).map(c => {
                return (
                  <li key={c.id} className="tooltip-owners-commit">
                    {c.message}
                    <span className="tooltip-owners-date">
                      {' '}- {moment(c.dateCreated).fromNow()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}>
        <Avatar user={author} />
      </span>
    );
  },

  render() {
    if (!(this.state.owners && this.state.owners.length)) {
      return null;
    }
    return (
      <div className="m-b-1">
        <h6>
          <span>{t('Suggested Owners')}</span>
          <small style={{background: '#FFFFFF'}}>Click to assign</small>
        </h6>
        <div className="avatar-grid">
          {this.state.owners.map(c => this.renderCommitter(c))}
        </div>
      </div>
    );
  }
});

export default SuggestedOwners;
