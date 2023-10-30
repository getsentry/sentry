import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Button} from 'sentry/components/button';
import Collapsible from 'sentry/components/collapsible';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Commit, User} from 'sentry/types';
import {percent} from 'sentry/utils';
import {userDisplayName} from 'sentry/utils/formatters';

type GroupedAuthorCommits = {
  [key: string]: {author: User | undefined; commitCount: number};
};

type Props = {
  orgId: string;
  projectSlug: string;
  version: string;
} & DeprecatedAsyncComponent['props'];

type State = {
  commits: Commit[];
} & DeprecatedAsyncComponent['state'];

class CommitAuthorBreakdown extends DeprecatedAsyncComponent<Props, State> {
  shouldReload = true;

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {orgId, projectSlug, version} = this.props;

    const commitsEndpoint = `/projects/${orgId}/${projectSlug}/releases/${encodeURIComponent(
      version
    )}/commits/`;

    return [['commits', commitsEndpoint]];
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.version !== this.props.version) {
      this.remountComponent();
    }
  }

  getDisplayPercent(authorCommitCount: number): string {
    const {commits} = this.state;

    const calculatedPercent = Math.round(percent(authorCommitCount, commits.length));

    return `${calculatedPercent < 1 ? '<1' : calculatedPercent}%`;
  }

  renderBody() {
    // group commits by author
    const groupedAuthorCommits = this.state.commits?.reduce<GroupedAuthorCommits>(
      (authorCommitsAccumulator, commit) => {
        const email = commit.author?.email ?? 'unknown';

        if (authorCommitsAccumulator.hasOwnProperty(email)) {
          authorCommitsAccumulator[email].commitCount += 1;
        } else {
          authorCommitsAccumulator[email] = {
            commitCount: 1,
            author: commit.author,
          };
        }

        return authorCommitsAccumulator;
      },
      {}
    );

    // sort authors by number of commits
    const sortedAuthorsByNumberOfCommits = Object.values(groupedAuthorCommits).sort(
      (a, b) => b.commitCount - a.commitCount
    );

    if (!sortedAuthorsByNumberOfCommits.length) {
      return null;
    }

    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('Commit Author Breakdown')}</SidebarSection.Title>
        <SidebarSection.Content>
          <Collapsible
            expandButton={({onExpand, numberOfHiddenItems}) => (
              <Button priority="link" onClick={onExpand}>
                {tn(
                  'Show %s collapsed author',
                  'Show %s collapsed authors',
                  numberOfHiddenItems
                )}
              </Button>
            )}
          >
            {sortedAuthorsByNumberOfCommits.map(({commitCount, author}, index) => (
              <AuthorLine key={author?.email ?? index}>
                <UserAvatar user={author} size={20} hasTooltip />
                <AuthorName>{userDisplayName(author || {}, false)}</AuthorName>
                <Commits>{tn('%s commit', '%s commits', commitCount)}</Commits>
                <Percent>{this.getDisplayPercent(commitCount)}</Percent>
              </AuthorLine>
            ))}
          </Collapsible>
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }
}

const AuthorLine = styled('div')`
  display: inline-grid;
  grid-template-columns: 30px 2fr 1fr 40px;
  width: 100%;
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const AuthorName = styled('div')`
  color: ${p => p.theme.textColor};
  ${p => p.theme.overflowEllipsis};
`;

const Commits = styled('div')`
  color: ${p => p.theme.subText};
  text-align: right;
`;

const Percent = styled('div')`
  min-width: 40px;
  text-align: right;
`;

export default CommitAuthorBreakdown;
