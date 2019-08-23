import {Sparklines} from 'react-sparklines';
import PropTypes from 'prop-types';

/**
 * This is required because:
 *
 * - React.Suspense only works with default exports
 * - typescript complains that the library's `propTypes` does not
 * have `children defined.
 * - typescript also won't let us access `Sparklines.propTypes`
 */
export default class SparklinesWithCustomPropTypes extends Sparklines {
  static propTypes = {
    children: PropTypes.node,
    data: PropTypes.array,
    limit: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    svgWidth: PropTypes.number,
    svgHeight: PropTypes.number,
    preserveAspectRatio: PropTypes.string,
    margin: PropTypes.number,
    style: PropTypes.object,
    min: PropTypes.number,
    max: PropTypes.number,
    onMouseMove: PropTypes.func,
  };
}
