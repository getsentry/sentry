import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import {Card} from 'sentry/components/card';

type Props = {
  imgUrl: string;
  link: string;
  title: string;
};

export function ResourceCard({title, link, imgUrl}: Props) {
  return (
    <Card interactive>
      <StyledLink href={link}>
        <StyledImg src={imgUrl} alt={title} />
        <StyledTitle>{title}</StyledTitle>
      </StyledLink>
    </Card>
  );
}

const StyledLink = styled(ExternalLink)`
  padding: ${p => p.theme.space['2xl']};
  flex: 1;
`;

const StyledImg = styled('img')`
  display: block;
  margin: 0 auto ${p => p.theme.space['2xl']} auto;
  height: 160px;
`;

const StyledTitle = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.lg};
  text-align: center;
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
