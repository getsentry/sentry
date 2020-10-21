import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import ExternalLink from 'app/components/links/externalLink';
import {Panel} from 'app/components/panels';
import space from 'app/styles/space';

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
  color: ${p => p.theme.gray700};
  font-size: ${p => p.theme.fontSizeLarge};
  text-align: center;
  font-weight: bold;
`;
