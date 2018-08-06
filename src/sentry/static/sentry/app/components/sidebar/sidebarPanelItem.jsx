import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../locale';
import ExternalLink from '../externalLink';

class SidebarPanelItem extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    image: PropTypes.string,
    message: PropTypes.any,
    link: PropTypes.string,
    hasSeen: PropTypes.bool,
  };

  render() {
    let {hasSeen, title, image, message, link} = this.props;

    return (
      <SidebarPanelItemRoot>
        {title && <Title hasSeen={hasSeen}>{title}</Title>}
        {image && (
          <div className="image">
            <img src={image} />
          </div>
        )}
        {message && <Message>{message}</Message>}

        {link && (
          <Text>
            <ExternalLink href={link}>{t('Read More')}</ExternalLink>
          </Text>
        )}
      </SidebarPanelItemRoot>
    );
  }
}

export default SidebarPanelItem;

const SidebarPanelItemRoot = styled('div')`
  padding: 15px 20px;
  line-height: 1.2;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.white};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  font-size: 14px;
`;

const Title = styled(({hasSeen, ...props}) => <div {...props} />)`
  font-size: 15px;
  margin-bottom: 5px;
  color: ${p => p.theme.gray5};
  ${p => !p.hasSeen && 'font-weight: 600;'};

  .culprit {
    font-weight: normal;
  }
`;

const Text = styled('div')`
  margin-bottom: 5px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Message = styled(Text)`
  color: ${p => p.theme.gray3};
`;
