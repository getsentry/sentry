import PropTypes from 'prop-types';
import React from 'react';
import uniqBy from 'lodash/uniqBy';
import flatMap from 'lodash/flatMap';
import styled from '@emotion/styled';

import CommitRow from 'app/components/commitRow';
import {IconAdd, IconSubtract} from 'app/icons';
import {Panel} from 'app/components/panels';
import {DataSection, CauseHeader} from 'app/components/events/styles';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';
import {t} from 'app/locale';

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  & > svg {
    margin-left: ${space(0.5)};
  }
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
      `/projects/${this.props.orgId}/${this.props.projectId}/events/${event.id}/committers/`,
      {
        success: data => {
          this.setState(data);
        },
        error: () => {
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
      <DataSection>
        <CauseHeader>
          <h3>
            {t('Suspect Commits')} ({commits.length})
          </h3>
          {commits.length > 1 && (
            <ExpandButton onClick={() => this.setState({expanded: !expanded})}>
              {expanded ? (
                <React.Fragment>
                  {t('Show less')} <IconSubtract isCircled size="md" />
                </React.Fragment>
              ) : (
                <React.Fragment>
                  {t('Show more')} <IconAdd isCircled size="md" />
                </React.Fragment>
              )}
            </ExpandButton>
          )}
        </CauseHeader>
        <Panel>
          {commits.slice(0, expanded ? 100 : 1).map(commit => (
            <CommitRow key={commit.id} commit={commit} />
          ))}
        </Panel>
      </DataSection>
    );
  }
}

export default withApi(EventCause);
