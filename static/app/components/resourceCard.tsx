import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {Panel} from 'sentry/components/panels';
import space from 'sentry/styles/space';
import {analytics} from 'sentry/utils/analytics';

type Props = {
  title: string;
  link: string;
  imgUrl: string;
};

const ResourceCard = ({title, link, imgUrl}: Props) => (
  <ResourceCardWrapper
    onClick={() => analytics('orgdash.resource_clicked', {link, title})}
  >
    <StyledLink href={link}>
      <StyledImg src={imgUrl} alt={title} />
      <StyledTitle>{title}</StyledTitle>
    </StyledLink>
  </ResourceCardWrapper>
);

export default ResourceCard;

const ResourceCardWrapper = styled(Panel)`
  display: flex;
  flex: 1;
  align-items: center;
  padding: ${space(3)};
  margin-bottom: 0;
`;

const StyledLink = styled(ExternalLink)`
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
