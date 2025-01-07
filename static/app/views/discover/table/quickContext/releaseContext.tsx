import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import {DataSection} from 'sentry/components/events/styles';
import Panel from 'sentry/components/panels/panel';
import TimeSince from 'sentry/components/timeSince';
import {IconNot} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {ReleaseWithHealth} from 'sentry/types/release';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniqueId} from 'sentry/utils/guid';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useUser} from 'sentry/utils/useUser';

import {NoContext} from './quickContextWrapper';
import {
  ContextBody,
  ContextContainer,
  ContextHeader,
  ContextRow,
  ContextTitle,
  Wrapper,
} from './styles';
import type {BaseContextProps} from './utils';
import {ContextType, tenSecondInMs} from './utils';

function ReleaseContext(props: BaseContextProps) {
  const user = useUser();
  const {dataRow, organization} = props;
  const {isPending, isError, data} = useApiQuery<ReleaseWithHealth>(
    [
      `/organizations/${organization.slug}/releases/${encodeURIComponent(
        dataRow.release
      )}/`,
    ],
    {
      staleTime: tenSecondInMs,
    }
  );

  const authors = useMemo(
    () =>
      data?.authors.map<Actor | User>(author =>
        // Add a unique id if missing
        ({
          ...author,
          type: 'user',
          id: 'id' in author ? author.id : uniqueId(),
        })
      ),
    [data?.authors]
  );

  useEffect(() => {
    trackAnalytics('discover_v2.quick_context_hover_contexts', {
      organization,
      contextType: ContextType.RELEASE,
    });
  }, [organization]);

  const getCommitAuthorTitle = () => {
    const commitCount = data?.commitCount || 0;
    let authorsCount = data?.authors?.length || 0;

    const userInAuthors =
      data &&
      authorsCount >= 1 &&
      data.authors.find(author => 'id' in author && user.id && author.id === user.id);

    if (userInAuthors) {
      authorsCount = authorsCount - 1;
      return authorsCount !== 1 && commitCount !== 1
        ? tct('[commitCount] commits by you and [authorsCount] others', {
            commitCount,
            authorsCount,
          })
        : commitCount !== 1
          ? tct('[commitCount] commits by you and 1 other', {
              commitCount,
            })
          : authorsCount !== 1
            ? tct('1 commit by you and [authorsCount] others', {
                authorsCount,
              })
            : t('1 commit by you and 1 other');
    }

    return (
      data &&
      (authorsCount !== 1 && commitCount !== 1
        ? tct('[commitCount] commits by [authorsCount] authors', {
            commitCount,
            authorsCount,
          })
        : commitCount !== 1
          ? tct('[commitCount] commits by 1 author', {
              commitCount,
            })
          : authorsCount !== 1
            ? tct('1 commit by [authorsCount] authors', {
                authorsCount,
              })
            : t('1 commit by 1 author'))
    );
  };

  const renderReleaseAuthors = () => {
    return (
      data && (
        <ReleaseContextContainer data-test-id="quick-context-release-details-container">
          <ContextHeader data-test-id="quick-context-release-author-header">
            <ContextTitle>{getCommitAuthorTitle()}</ContextTitle>
          </ContextHeader>
          <ContextBody>
            {data.commitCount === 0 ? (
              <IconNot color="gray500" size="md" />
            ) : (
              <StyledAvatarList users={authors} maxVisibleAvatars={10} />
            )}
          </ContextBody>
        </ReleaseContextContainer>
      )
    );
  };

  const renderLastCommit = () =>
    data?.lastCommit && (
      <ReleaseContextContainer data-test-id="quick-context-release-last-commit-container">
        <ContextHeader>
          <ContextTitle>{t('Last Commit')}</ContextTitle>
        </ContextHeader>
        <DataSection>
          <Panel>
            <QuickContextCommitRow commit={data.lastCommit} />
          </Panel>
        </DataSection>
      </ReleaseContextContainer>
    );

  const renderReleaseDetails = () =>
    data && (
      <ReleaseContextContainer data-test-id="quick-context-release-issues-and-authors-container">
        <ContextRow>
          <div>
            <ContextHeader>
              <ContextTitle>{t('Created')}</ContextTitle>
            </ContextHeader>
            <ReleaseBody>
              <TimeSince date={data.dateCreated} />
            </ReleaseBody>
          </div>
          <div>
            <ContextHeader>
              <ContextTitle>{t('Last Event')}</ContextTitle>
            </ContextHeader>
            <ReleaseBody>
              {data.lastEvent ? <TimeSince date={data.lastEvent} /> : '\u2014'}
            </ReleaseBody>
          </div>
          <div>
            <ContextHeader>
              <ContextTitle>{t('New Issues')}</ContextTitle>
            </ContextHeader>
            <ContextBody>{data.newGroups}</ContextBody>
          </div>
        </ContextRow>
      </ReleaseContextContainer>
    );

  if (isPending || isError) {
    return <NoContext isLoading={isPending} />;
  }

  return (
    <Wrapper data-test-id="quick-context-hover-body">
      {renderReleaseDetails()}
      {renderReleaseAuthors()}
      {renderLastCommit()}
    </Wrapper>
  );
}

const StyledAvatarList = styled(AvatarList)`
  margin: 0 ${space(0.75)};
`;

const ReleaseContextContainer = styled(ContextContainer)`
  ${Panel} {
    margin: 0;
    border: none;
    box-shadow: none;
  }
  ${DataSection} {
    padding: 0;
  }
  & + & {
    margin-top: ${space(2)};
  }
`;

const ReleaseBody = styled(ContextBody)<{}>`
  font-size: 13px;
  color: ${p => p.theme.subText};
`;

export default ReleaseContext;
