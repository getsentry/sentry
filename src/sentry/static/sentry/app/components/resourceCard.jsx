import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import ExternalLink from 'app/components/links/externalLink';
import {Panel} from 'app/components/panels';
import space from 'app/styles/space';

export default class ResourceCard extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    imgUrl: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  };

  recordClick = () => {
    const {link, title} = this.props;
    analytics('orgdash.resource_clicked', {link, title});
  };

  render() {
    const {title, link, imgUrl} = this.props;

    return (
      <ResourceCardWrapper onClick={this.recordClick}>
        <StyledLink href={link}>
          <StyledImg src={imgUrl} alt={title} />
          <StyledTitle>{title}</StyledTitle>
        </StyledLink>
      </ResourceCardWrapper>
    );
  }
}

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
  color: ${p => p.theme.gray4};
  font-size: ${p => p.theme.fontSizeLarge};
  text-align: center;
  font-weight: bold;
`;
