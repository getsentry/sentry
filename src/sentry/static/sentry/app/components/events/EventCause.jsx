import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {uniqBy, flatMap} from 'lodash';
import styled from 'react-emotion';

import ApiMixin from 'app/mixins/apiMixin';
import GroupState from 'app/mixins/groupState';
import CommitRow from 'app/components/commitRow';
import InlineSvg from 'app/components/inlineSvg';

import {t} from 'app/locale';

import {Panel} from 'app/components/panels';

const ExpandButton = styled.span`
  cursor: pointer;
  position: absolute;
  right: 0;
  top: 7px;
`;

export default createReactClass({
  displayName: 'EventCause',

  propTypes: {
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {committers: undefined, expanded: false};
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

  fetchData(event) {
    // TODO(dcramer): this API request happens twice, and we need a store for it
    if (!event) return;
    this.api.request(
      `/projects/${this.props.orgId}/${this.props
        .projectId}/events/${event.id}/committers/`,
      {
        success: (data, _, jqXHR) => {
          this.setState(data);
        },
        error: error => {
          this.setState({
            committers: undefined,
          });
        },
      }
    );
  },

  getUniqueCommitsWithAuthors() {
    let {committers} = this.state;
    //get a list of commits with author information attached
    let commitsWithAuthors = flatMap(committers, ({commits, author}) =>
      commits.map(commit => ({
        ...commit,
        author,
      }))
    );

    //remove duplicate commits
    let uniqueCommitsWithAuthors = uniqBy(commitsWithAuthors, commit => commit.id);
    return uniqueCommitsWithAuthors;
  },

  render() {
    let {committers, expanded} = this.state;
    if (!(committers && committers.length)) {
      return null;
    }

    let commits = this.getUniqueCommitsWithAuthors();

    return (
      <div className="box">
        <div className="box-header">
          <h3>
            {t('Suspect Commits')} ({commits.length})
            {commits.length > 1 && (
              <ExpandButton onClick={() => this.setState({expanded: !expanded})}>
                {expanded ? (
                  <React.Fragment>
                    {t('Show less')} <InlineSvg src="icon-circle-subtract" size="16px" />
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    {t('Show more')} <InlineSvg src="icon-circle-add" size="16px" />
                  </React.Fragment>
                )}
              </ExpandButton>
            )}
          </h3>
          <Panel>
            {commits.slice(0, expanded ? 100 : 1).map(commit => {
              return <CommitRow key={commit.id} commit={commit} />;
            })}
          </Panel>
        </div>
      </div>
    );
  },
});
