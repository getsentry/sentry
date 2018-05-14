import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import marked from 'marked';
import styled from 'react-emotion';

import {t} from 'app/locale';

const Details = styled(Flex)`
  font-size: 1.5rem;
  line-height: 2.1rem;
`;

const Description = styled.div`
  li {
    margin-bottom: 6px;
  }
`;

const AuthorName = styled.div`
  color: ${p => p.theme.gray2};
`;

const MetadataLink = styled.a`
  display: block;
  margin-bottom: 6px;
`;

export default class IntegrationDetails extends React.Component {
  static propTypes = {
    markdownDescription: PropTypes.string.isRequired,
    author: PropTypes.string.isRequired,
    links: PropTypes.arrayOf(
      PropTypes.shape({
        href: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
      })
    ),
  };

  render() {
    const description = marked(this.props.markdownDescription);

    return (
      <Details>
        <Box width={5 / 8}>
          <Description dangerouslySetInnerHTML={{__html: description}} />
          <AuthorName>{t('By %s', this.props.author)}</AuthorName>
        </Box>
        <Box ml={60}>
          {this.props.links.map(({href, title}) => (
            <MetadataLink key={href} href={href}>
              {title}
            </MetadataLink>
          ))}
        </Box>
      </Details>
    );
  }
}
