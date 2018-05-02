import PropTypes from 'prop-types';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import HookStore from 'app/stores/hookStore';

/**
 * Instead of accessing the HookStore directly, use this.
 *
 * If the hook slot needs to perform anything w/ the hooks, you can pass a function as a child and you will receive an object with a `hooks` key
 *
 * example:
 *
 * <Hook name="my-hook">
 * {({hooks}) => hooks.map(hook => (
 *  <Wrapper>
 *    {hook}
 * </Wrapper>
 * ))}
 * </Hook>
 *
 */
const Hook = createReactClass({
  displayName: 'Hook',
  propTypes: {
    name: PropTypes.string.isRequired,
  },
  mixins: [Reflux.listenTo(HookStore, 'handleHooks')],

  getInitialState() {
    let {name, ...props} = this.props;

    return {
      hooks: HookStore.get(name).map(cb => cb(props)),
    };
  },

  handleHooks(hookName, hooks) {
    let {name, ...props} = this.props;

    // Make sure that the incoming hook update matches this component's hook name
    if (hookName !== name) return;

    this.setState(state => ({
      hooks: hooks.map(cb => cb(props)),
    }));
  },

  render() {
    let {children} = this.props;

    if (!this.state.hooks || !this.state.hooks.length) return null;

    if (typeof children === 'function') {
      return children({hooks: this.state.hooks});
    }

    return this.state.hooks;
  },
});

export default Hook;
