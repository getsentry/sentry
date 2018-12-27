import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import analytics from 'app/utils/analytics';
import ConfigStore from 'app/stores/configStore';
import ExternalLink from 'app/components/externalLink';
import {Panel} from 'app/components/panels';

export default class ResourceCard extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    imgUrl: PropTypes.string.isRequired,
  };

  recordClick = () => {
    let {link, title} = this.props;
    analytics('orgdash.resource_clicked', {link, title});
  };

  render() {
    const mediaUrl = ConfigStore.get('mediaUrl');
    let {title, link, imgUrl} = this.props;

    return (
      <ResourceCardWrapper onClick={this.recordClick}>
        <StyledLink href={link}>
          <div className="m-b-1">
            <img src={mediaUrl + imgUrl} alt={title} />
          </div>
          <StyledTitle>{title}</StyledTitle>
        </StyledLink>
      </ResourceCardWrapper>
    );
  }
}

const StyledTitle = styled('div')`
  color: #493e54;
  font-size: 16px;
  text-align: center;
  font-weight: bold;
`;

const ResourceCardWrapper = styled(Panel)`
  display: flex;
  flex: 1;
  align-items: center;
  padding: 20px;
  margin-bottom: 0;
`;

const StyledLink = styled(ExternalLink)`
  flex: 1;
`;
