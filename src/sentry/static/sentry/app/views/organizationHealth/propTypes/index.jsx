import PropTypes from 'prop-types';

const HealthContextActions = PropTypes.shape({
  updateParams: PropTypes.func.isRequired,
  setSpecifier: PropTypes.func.isRequired,
});

export {HealthContextActions};
