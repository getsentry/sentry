import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import Card from 'sentry/components/card';
import {space} from 'sentry/styles/space';

type Props = {
  imgUrl: string;
  link: string;
  title: string;
};

function ResourceCard({title, link, imgUrl}: Props) {
  return (
    <Card interactive>
      <StyledLink href={link}>
        <StyledImg src={imgUrl} alt={title} />
        <StyledTitle>{title}</StyledTitle>
      </StyledLink>
    </Card>
  );
}

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
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.lg};
  text-align: center;
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
