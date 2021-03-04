import React from 'react';
import * as Sentry from '@sentry/react';
import rrwebPlayer from 'rrweb-player';

import {Panel} from 'app/components/panels';

type Props = {
  url: string;
  className?: string;
};

class RRWebReplayer extends React.Component<Props> {
  componentDidMount() {
    this.rrwebPlayer();
  }

  wrapperRef = React.createRef<HTMLDivElement>();

  newRRWebPlayer: any;

  rrwebPlayer = async () => {
    const element = this.wrapperRef?.current;

    if (!element) {
      return;
    }

    const {url} = this.props;

    try {
      const resp = await fetch(url);
      const payload = await resp.json();

      this.newRRWebPlayer = new rrwebPlayer({
        target: element,
        data: payload,
        autoplay: false,
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  render() {
    const {className} = this.props;

    const content = <div ref={this.wrapperRef} className={className} />;

    if (this.newRRWebPlayer) {
      return <Panel>{content}</Panel>;
    }

    return content;
  }
}

export default RRWebReplayer;
