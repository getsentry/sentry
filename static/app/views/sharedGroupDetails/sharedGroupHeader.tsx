import styled from '@emotion/styled';

import EventMessage from 'sentry/components/events/eventMessage';
import FeatureBadge from 'sentry/components/featureBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, IssueCategory} from 'sentry/types';

import UnhandledTag, {
  TagAndMessageWrapper,
} from '../organizationGroupDetails/unhandledTag';

type Props = {
  group: Group;
};

const SharedGroupHeader = ({group}: Props) => (
  <Wrapper>
    <Details>
      <TitleWrap>
        <Title>{group.title}</Title>
        <ShortIdWrapper>
          <ShortId
            shortId={group.shortId}
            avatar={<ProjectBadge project={group.project} avatarSize={20} hideName />}
          />
          {group.issueCategory === IssueCategory.PERFORMANCE && (
            <FeatureBadge
              type="beta"
              title={t(
                'Not all features have been implemented for shared Performance Issues and these issues may be missing context.'
              )}
            />
          )}
        </ShortIdWrapper>
      </TitleWrap>

      <TagAndMessageWrapper>
        {group.isUnhandled && <UnhandledTag />}
        <EventMessage message={group.culprit} />
      </TagAndMessageWrapper>
    </Details>
  </Wrapper>
);

export default SharedGroupHeader;

const Wrapper = styled('div')`
  padding: ${space(3)} ${space(4)} ${space(3)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};
  position: relative;
`;

const Details = styled('div')`
  max-width: 960px;
  margin: 0 auto;
`;

const ShortIdWrapper = styled('div')`
  display: flex;
`;

const TitleWrap = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const Title = styled('h3')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: ${p => p.theme.text.lineHeightHeading};
  margin-right: ${space(2)};
  margin-bottom: 0;
  ${p => p.theme.overflowEllipsis};

  @media (min-width: ${props => props.theme.breakpoints.small}) {
    font-size: ${p => p.theme.headerFontSize};
  }
`;
