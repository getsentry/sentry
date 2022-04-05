import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import flatMap from 'lodash/flatMap';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'sentry/api';
import {CommitRow} from 'sentry/components/commitRow';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import {Panel} from 'sentry/components/panels';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  withCommitters,
  WithCommittersProps,
} from 'sentry/stores/commiters/withCommitters';
import space from 'sentry/styles/space';
import {AvatarProject, Group, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withApi from 'sentry/utils/withApi';

interface Props extends WithCommittersProps {
  // injected by HoC
  api: Client;
  event: Event;

  // needed by HoC
  organization: Organization;
  project: AvatarProject;
  group?: Group;
}

type State = {
  expanded: boolean;
};

class EventCause extends Component<Props, State> {
  state: State = {
    expanded: false,
  };

  getUniqueCommitsWithAuthors() {
    // Get a list of commits with author information attached
    const commitsWithAuthors = flatMap(this.props.committers, ({commits, author}) =>
      commits.map(commit => ({
        ...commit,
        author,
      }))
    );

    // Remove duplicate commits
    return uniqBy(commitsWithAuthors, commit => commit.id);
  }

  render() {
    if (!this.props.committers?.length) {
      return null;
    }

    const commits = this.getUniqueCommitsWithAuthors();

    return (
      <DataSection>
        <CauseHeader>
          <h3 data-test-id="event-cause">
            {t('Suspect Commits')} ({commits.length})
          </h3>
          {commits.length > 1 && (
            <ExpandButton onClick={() => this.setState({expanded: !this.state.expanded})}>
              {this.state.expanded ? (
                <Fragment>
                  {t('Show less')} <IconSubtract isCircled size="md" />
                </Fragment>
              ) : (
                <Fragment>
                  {t('Show more')} <IconAdd isCircled size="md" />
                </Fragment>
              )}
            </ExpandButton>
          )}
        </CauseHeader>
        <Panel>
          {commits.slice(0, this.state.expanded ? 100 : 1).map(commit => (
            <CommitRow key={commit.id} commit={commit} />
          ))}
        </Panel>
      </DataSection>
    );
  }
}

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  & > svg {
    margin-left: ${space(0.5)};
  }
`;

export default withApi(withCommitters(EventCause));
