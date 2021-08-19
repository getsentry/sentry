import {Component} from 'react';
import {InjectedRouter} from 'react-router';
import {LocationDescriptor} from 'history';

type Props = {
  router: InjectedRouter;
  to: LocationDescriptor;
};

// This is react-router v4 <Redirect to="path/" /> component to allow things
// to be declarative.
class Redirect extends Component<Props> {
  componentDidMount() {
    this.props.router.replace(this.props.to);
  }

  render() {
    return null;
  }
}

export default Redirect;
