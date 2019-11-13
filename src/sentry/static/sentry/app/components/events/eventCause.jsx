import PropTypes from 'prop-types';
import React from 'react';
import uniqBy from 'lodash/uniqBy';
import flatMap from 'lodash/flatMap';
import styled from 'react-emotion';

import CommitRow from 'app/components/commitRow';
import InlineSvg from 'app/components/inlineSvg';
import withApi from 'app/utils/withApi';

import {t} from 'app/locale';

import {Panel} from 'app/components/panels';

const ExpandButton = styled('span')`
  cursor: pointer;
  position: absolute;
  right: 0;
  top: 7px;
`;

class EventCause extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  state = {
    committers: undefined,
    expanded: false,
  };

  componentDidMount() {
    this.fetchData(this.props.event);
  }

  componentDidUpdate(prevProps) {
    let doFetch = false;
    if (!prevProps.event && this.props.event) {
      // going from having no event to having an event
      doFetch = true;
    } else if (this.props.event && this.props.event.id !== prevProps.event.id) {
      doFetch = true;
    }

    if (doFetch) {
      this.fetchData(this.props.event);
    }
  }

  fetchData(event) {
    // TODO(dcramer): this API request happens twice, and we need a store for it
    if (!event) {
      return;
    }
    this.props.api.request(
      `/projects/${this.props.orgId}/${this.props.projectId}/events/${
        event.id
      }/committers/`,
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
  }

  getUniqueCommitsWithAuthors() {
    const {committers} = this.state;
    //get a list of commits with author information attached
    const commitsWithAuthors = flatMap(committers, ({commits, author}) =>
      commits.map(commit => ({
        ...commit,
        author,
      }))
    );

    //remove duplicate commits
    const uniqueCommitsWithAuthors = uniqBy(commitsWithAuthors, commit => commit.id);
    return uniqueCommitsWithAuthors;
  }

  render() {
    const {committers, expanded} = this.state;
    if (!(committers && committers.length)) {
      return null;
    }

    const commits = this.getUniqueCommitsWithAuthors();

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
  }
}

export default withApi(EventCause);
