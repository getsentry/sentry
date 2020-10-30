import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  children: React.ReactNode;
  className?: string;
  withMargins?: boolean;
};

const PageHeading = styled('h1')<Props>`
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray700};
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
