import PropTypes from 'prop-types';

import {formatAbbreviatedNumber} from 'app/utils/formatters';

type Props = {
  value: string | number;
  className?: string;
};

function Count(props: Props) {
  const {value, className} = props;

  return <span className={className}>{formatAbbreviatedNumber(value)}</span>;
}
Count.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default Count;
