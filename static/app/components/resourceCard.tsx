import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import ExternalLink from 'sentry/components/links/externalLink';
import {space} from 'sentry/styles/space';
import {analytics} from 'sentry/utils/analytics';

type Props = {
  imgUrl: string;
  link: string;
  title: string;
};

const ResourceCard = ({title, link, imgUrl}: Props) => (
  <Card interactive>
    <StyledLink
      href={link}
      onClick={() => analytics('orgdash.resource_clicked', {link, title})}
    >
      <StyledImg src={imgUrl} alt={title} />
      <StyledTitle>{title}</StyledTitle>
    </StyledLink>
  </Card>
);

export default ResourceCard;

const StyledLink = styled(ExternalLink)`
  padding: ${space(3)};
  flex: 1;
`;

const StyledImg = styled('img')`
  display: block;
  margin: 0 auto ${space(3)} auto;
  height: 160px;
`;

const StyledTitle = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeLarge};
  text-align: center;
  font-weight: bold;
`;
