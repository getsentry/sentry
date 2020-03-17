import React from 'react';
import classnames from 'classnames';

import {t} from 'app/locale';
import Button from 'app/components/button';

type Props = {
  /**
   * Title to render above the content
   */
  title?: string;
  /**
   * By default should the content be clipped
   */
  defaultClipped: boolean;
  /**
   * Height in pixles that the content should clip at
   */
  clipHeight: number;
  /**
   * The text of the show button
   */
  btnText: string;
};

type State = {
  clipped: boolean;
  revealed: boolean;
};

class ClippedBox extends React.Component<Props, State> {
  static defaultProps = {
    defaultClipped: false,
    clipHeight: 200,
    btnText: t('Show More'),
  };

  state: State = {
    clipped: this.props.defaultClipped,
    revealed: false, // True once user has clicked "Show More" button
  };

  componentDidMount() {
    if (!this.elRef.current) {
      return;
    }

    const renderedHeight = this.elRef.current.offsetHeight;

    if (!this.state.clipped && renderedHeight > this.props.clipHeight) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({clipped: true});
    }
  }

  elRef = React.createRef<HTMLDivElement>();

  reveal = (e: React.MouseEvent) => {
    e.stopPropagation();

    this.setState({clipped: false, revealed: true});
  };

  render() {
    const {title, children, clipHeight, btnText} = this.props;
    const {clipped, revealed} = this.state;

    const className = classnames('box-clippable', {clipped, revealed});

    return (
      <div
        ref={this.elRef}
        className={className}
        style={{maxHeight: clipped ? clipHeight : undefined}}
      >
        {title && <h5>{title}</h5>}
        {children}

        {this.state.clipped && (
          <div className="clip-fade">
            <Button onClick={this.reveal} priority="primary" size="xsmall">
              {btnText}
            </Button>
          </div>
        )}
      </div>
    );
  }
}

export default ClippedBox;
