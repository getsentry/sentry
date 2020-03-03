import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import UserAvatar from 'app/components/avatar/userAvatar';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {};

const CommitAuthorBreakdown = ({}: Props) => {
  return (
    <Wrapper>
      <SectionHeading>{t('Commit Author Breakdown')}</SectionHeading>
      {[1, 2, 3, 4].map(() => (
        <AuthorLine key={name}>
          <Author>
            <StyledUserAvatar
              user={{
                name: 'Matej Minar',
                email: 'matej.minar@sentry.io',
              }}
              size={20}
              hasTooltip
            />
            <AuthorName>Matej Minar</AuthorName>
          </Author>

          <Stats>
            <Commits>15 commits</Commits>
            <Percent>100%</Percent>
          </Stats>
        </AuthorLine>
      ))}
    </Wrapper>
  );
};

const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  padding-right: ${space(1)};
  line-height: 1.2;
`;

const Wrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(4)};
`;

const AuthorLine = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};
`;

const Author = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  overflow: hidden;
`;

const StyledUserAvatar = styled(UserAvatar)`
  margin-right: ${space(1)};
`;

const AuthorName = styled('div')`
  font-weight: 600;
  color: ${p => p.theme.gray3};
  ${overflowEllipsis}
`;

const Stats = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 115px;
`;

const Commits = styled('div')`
  color: ${p => p.theme.gray2};
`;

const Percent = styled('div')`
  min-width: 40px;
  text-align: right;
  color: ${p => p.theme.gray4};
`;

export default CommitAuthorBreakdown;
