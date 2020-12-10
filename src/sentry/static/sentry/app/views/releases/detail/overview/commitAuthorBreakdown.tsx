import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import UserAvatar from 'app/components/avatar/userAvatar';
import Button from 'app/components/button';
import {t, tn} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Commit, User} from 'app/types';
import {percent} from 'app/utils';
import {userDisplayName} from 'app/utils/formatters';

import {SectionHeading, Wrapper} from './styles';

type GroupedAuthorCommits = {
  [key: string]: {author: User | undefined; commitCount: number};
};

type Props = {
  projectSlug: string;
  orgId: string;
  version: string;
} & AsyncComponent['props'];

type State = {
  commits: Commit[];
  collapsed: boolean;
} & AsyncComponent['state'];

class CommitAuthorBreakdown extends AsyncComponent<Props, State> {
  static MAX_WHEN_COLLAPSED = 5;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      collapsed: true,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectSlug, version} = this.props;

    const commitsEndpoint = `/projects/${orgId}/${projectSlug}/releases/${encodeURIComponent(
      version
    )}/commits/`;

    return [['commits', commitsEndpoint]];
  }

  getDisplayPercent(authorCommitCount: number): string {
    const {commits} = this.state;

    const calculatedPercent = Math.round(percent(authorCommitCount, commits.length));

    return `${calculatedPercent < 1 ? '<1' : calculatedPercent}%`;
  }

  onCollapseToggle = () => {
    this.setState(state => ({
      collapsed: !state.collapsed,
    }));
  };

  renderBody() {
    const {collapsed} = this.state;

    // group commits by author
    const groupedAuthorCommits = this.state.commits?.reduce(
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
      {} as GroupedAuthorCommits
    );

    // sort authors by number of commits
    let sortedAuthorsByNumberOfCommits = Object.values(groupedAuthorCommits).sort(
      (a, b) => b.commitCount - a.commitCount
    );

    if (!sortedAuthorsByNumberOfCommits.length) {
      return null;
    }

    // collapse them
    const MAX = CommitAuthorBreakdown.MAX_WHEN_COLLAPSED;
    const initialNumberOfAuthors = sortedAuthorsByNumberOfCommits.length;
    const canExpand = initialNumberOfAuthors > MAX;
    if (collapsed && canExpand) {
      sortedAuthorsByNumberOfCommits = sortedAuthorsByNumberOfCommits.slice(0, MAX);
    }
    const collapsedNumberOfAuthors =
      initialNumberOfAuthors - sortedAuthorsByNumberOfCommits.length;

    return (
      <Wrapper>
        <SectionHeading>{t('Commit Author Breakdown')}</SectionHeading>
        {sortedAuthorsByNumberOfCommits.map(({commitCount, author}) => (
          <AuthorLine key={author?.email}>
            <UserAvatar user={author} size={20} hasTooltip />
            <AuthorName>{userDisplayName(author || {}, false)}</AuthorName>
            <Commits>{tn('%s commit', '%s commits', commitCount)}</Commits>
            <Percent>{this.getDisplayPercent(commitCount)}</Percent>
          </AuthorLine>
        ))}
        {collapsedNumberOfAuthors > 0 && (
          <Button priority="link" onClick={this.onCollapseToggle}>
            {tn(
              'Show %s collapsed author',
              'Show %s collapsed authors',
              collapsedNumberOfAuthors
            )}
          </Button>
        )}
        {collapsedNumberOfAuthors === 0 && canExpand && (
          <Button priority="link" onClick={this.onCollapseToggle}>
            {t('Collapse authors')}
          </Button>
        )}
      </Wrapper>
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
  ${overflowEllipsis};
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
