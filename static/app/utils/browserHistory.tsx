import {browserHistory as react3BrowserHistory} from 'react-router';

/**
 * @deprecated Prefer using useNavigate
 *
 * browserHistory is a hold-over from react-router 3 days. In react-router 6
 * the useNavigate hook is the native way to trigger navigation events.
 *
 * browserHistory.push('/next')    -> navigate('/next')
 * browserHistory.replace('/next') -> navigate('/next', {replace: true})
 */
export const browserHistory = react3BrowserHistory;
