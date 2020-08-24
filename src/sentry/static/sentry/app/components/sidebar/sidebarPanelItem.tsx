import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from '../../locale';
import ExternalLink from '../links/externalLink';

type Props = {
  hasSeen?: boolean;
  title?: string;
  image?: string;
  message?: React.ReactNode;
  link?: string;
  cta?: string;
};

const SidebarPanelItem = ({hasSeen, title, image, message, link, cta}: Props) => (
  <SidebarPanelItemRoot>
    {title && <Title hasSeen={hasSeen}>{title}</Title>}
    {image && (
      <ImageBox>
        <img src={image} />
      </ImageBox>
    )}
    {message && <Message>{message}</Message>}

    {link && (
      <Text>
        <ExternalLink href={link}>{cta || t('Read More')}</ExternalLink>
      </Text>
    )}
  </SidebarPanelItemRoot>
);

SidebarPanelItem.propTypes = {
  title: PropTypes.string,
  image: PropTypes.string,
  message: PropTypes.node,
  link: PropTypes.string,
  hasSeen: PropTypes.bool,
  cta: PropTypes.string,
};

export default SidebarPanelItem;

const SidebarPanelItemRoot = styled('div')`
  padding: 15px 20px;
  line-height: 1.2;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.white};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  font-size: 14px;
`;

const ImageBox = styled('div')`
  border: 1px solid #e1e4e5;
  padding: 15px;
  border-radius: 2px;
`;

const Title = styled('div')<Pick<Props, 'hasSeen'>>`
  font-size: 15px;
  margin-bottom: 5px;
  color: ${p => p.theme.gray800};
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
  color: ${p => p.theme.gray600};
`;
