import PropTypes from 'prop-types';
import styled from 'react-emotion';

import space from 'app/styles/space';

const PageHeading = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
  margin-bottom: ${p => p.withMargins && space(3)};
  margin-top: ${p => p.withMargins && space(1)};
`;

PageHeading.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  withMargins: PropTypes.bool,
};

export default PageHeading;
