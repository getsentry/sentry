import React, {Component} from 'react';
import PropTypes from 'prop-types';

import 'rrweb-player/dist/style.css';
import rrwebPlayer from 'rrweb-player';

export default class RRWebReplayer extends Component {
  static propTypes = {
    url: PropTypes.string.isRequired,
  };

  async componentDidMount() {
    const resp = await fetch(this.props.url);
    const payload = await resp.json();
    const _ = new rrwebPlayer({
      target: this.ref.current,
      autoplay: false,
      data: {
        ...payload,
      },
    });
  }

  ref = React.createRef();

  render() {
    return <div ref={this.ref} />;
  }
}
