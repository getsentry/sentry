import styled from 'react-emotion';
import PropTypes from 'prop-types';

const Well = styled('div')`
  border: 1px solid ${p => p.theme.borderLight};
  box-shadow: 'none';
  background: ${p => p.theme.whiteDark};
  padding: ${p => (p.hasImage ? '80px 30px' : '15px 20px')};
  margin-bottom: 20px;
  border-radius: 3px;
  ${p => p.centered && 'text-align: center'};
`;

Well.propTypes = {
  hasImage: PropTypes.bool,
  centered: PropTypes.bool,
};

Well.defaultProps = {
  hasImage: false,
  centered: false,
};

export default Well;
