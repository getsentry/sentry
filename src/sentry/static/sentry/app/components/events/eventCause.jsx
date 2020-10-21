import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import uniqBy from 'lodash/uniqBy';
import flatMap from 'lodash/flatMap';
import styled from '@emotion/styled';

import CommitRow from 'app/components/commitRow';
import {IconAdd, IconSubtract} from 'app/icons';
import {Panel} from 'app/components/panels';
import {DataSection, CauseHeader} from 'app/components/events/styles';
import withApi from 'app/utils/withApi';
import withCommitters from 'app/utils/withCommitters';
import space from 'app/styles/space';
import {t} from 'app/locale';

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  & > svg {
    margin-left: ${space(0.5)};
  }
`;

class EventCause extends Component {
  static propTypes = {
    committers: PropTypes.array.isRequired,
  };

  state = {
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
          {commits.slice(0, expanded ? 100 : 1).map(commit => (
            <CommitRow key={commit.id} commit={commit} />
          ))}
        </Panel>
      </DataSection>
    );
  }
}

export default withApi(withCommitters(EventCause));
