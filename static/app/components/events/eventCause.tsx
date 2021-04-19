import React from 'react';
import styled from '@emotion/styled';
import flatMap from 'lodash/flatMap';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'app/api';
import CommitRow from 'app/components/commitRow';
import {CauseHeader, DataSection} from 'app/components/events/styles';
import {Panel} from 'app/components/panels';
import {IconAdd, IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {AvatarProject, Committer, Group, Organization} from 'app/types';
import {Event} from 'app/types/event';
import withApi from 'app/utils/withApi';
import withCommitters from 'app/utils/withCommitters';

type Props = {
  // injected by HoC
  committers: Committer[];
  api: Client;

  // needed by HoC
  organization: Organization;
  project: AvatarProject;
  event: Event;
  group?: Group;
};

type State = {
  expanded: boolean;
};

class EventCause extends React.Component<Props, State> {
  state: State = {
    expanded: false,
  };

  getUniqueCommitsWithAuthors() {
    const {committers} = this.props;

    // Get a list of commits with author information attached
    const commitsWithAuthors = flatMap(committers, ({commits, author}) =>
      commits.map(commit => ({
        ...commit,
        author,
      }))
    );

    // Remove duplicate commits
    const uniqueCommitsWithAuthors = uniqBy(commitsWithAuthors, commit => commit.id);

    return uniqueCommitsWithAuthors;
  }

  render() {
    const {committers} = this.props;
    const {expanded} = this.state;

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

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  & > svg {
    margin-left: ${space(0.5)};
  }
`;

export default withApi(withCommitters(EventCause));
