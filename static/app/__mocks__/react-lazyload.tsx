/**
 * Auto-mock of the react-lazyload library for jest
 *
 * These mocks are simple no-ops to make testing lazy-loaded components simpler.
 */

const LazyLoad = ({children}) => children;

export const forceCheck = jest.fn();

export default LazyLoad;
