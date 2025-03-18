/**
 * Auto-mock of the react-lazyload library for vi
 *
 * These mocks are simple no-ops to make testing lazy-loaded components simpler.
 */

const LazyLoad = ({children}: {children: React.ReactNode}) => children;

export const forceCheck = vi.fn();

export default LazyLoad;
