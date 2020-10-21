import * as React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Button from 'app/components/button';
import space from 'app/styles/space';

type DefaultProps = {
  clipHeight?: number;
  btnText?: string;
  defaultClipped?: boolean;
};

type Props = {
  clipHeight: number;
  title?: string;
  renderedHeight?: number;
  onReveal?: () => void;
  className?: string;
} & DefaultProps;

type State = {
  isClipped: boolean;
  isRevealed: boolean;
  renderedHeight?: number;
};

class ClippedBox extends React.PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    defaultClipped: false,
    clipHeight: 200,
    btnText: t('Show More'),
  };

  state: State = {
    isClipped: !!this.props.defaultClipped,
    isRevealed: false, // True once user has clicked "Show More" button
    renderedHeight: this.props.renderedHeight,
  };

  componentDidMount() {
    // eslint-disable-next-line react/no-find-dom-node
    const renderedHeight = (ReactDOM.findDOMNode(this) as HTMLElement).offsetHeight;
    this.calcHeight(renderedHeight);
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.renderedHeight !== this.props.renderedHeight) {
      this.setRenderedHeight();
    }

    if (prevState.renderedHeight !== this.state.renderedHeight) {
      this.calcHeight(this.state.renderedHeight);
    }

    if (this.state.isRevealed || !this.state.isClipped) {
      return;
    }

    if (!this.props.renderedHeight) {
      // eslint-disable-next-line react/no-find-dom-node
      const renderedHeight = (ReactDOM.findDOMNode(this) as HTMLElement).offsetHeight;

      if (renderedHeight < this.props.clipHeight) {
        this.reveal();
      }
    }
  }

  setRenderedHeight() {
    this.setState({
      renderedHeight: this.props.renderedHeight,
    });
  }

  calcHeight(renderedHeight?: number) {
    if (!renderedHeight) {
      return;
    }

    if (!this.state.isClipped && renderedHeight > this.props.clipHeight) {
      /*eslint react/no-did-mount-set-state:0*/
      // okay if this causes re-render; cannot determine until
      // rendered first anyways
      this.setState({
        isClipped: true,
      });
    }
  }

  reveal = () => {
    const {onReveal} = this.props;

    this.setState({
      isClipped: false,
      isRevealed: true,
    });

    if (onReveal) {
      onReveal();
    }
  };

  handleClickReveal = (event: React.MouseEvent) => {
    event.stopPropagation();
    this.reveal();
  };

  render() {
    const {isClipped, isRevealed} = this.state;
    const {title, children, clipHeight, btnText, className} = this.props;

    return (
      <ClipWrapper
        clipHeight={clipHeight}
        isClipped={isClipped}
        isRevealed={isRevealed}
        className={className}
      >
        {title && <Title>{title}</Title>}
        {children}
        {isClipped && (
          <ClipFade>
            <Button onClick={this.reveal} priority="primary" size="xsmall">
              {btnText}
            </Button>
          </ClipFade>
        )}
      </ClipWrapper>
    );
  }
}

export default ClippedBox;

const ClipWrapper = styled('div', {
  shouldForwardProp: prop =>
    prop !== 'clipHeight' && prop !== 'isClipped' && prop !== 'isRevealed',
})<State & {clipHeight: number}>`
  position: relative;
  margin-left: -${space(3)};
  margin-right: -${space(3)};
  padding: ${space(2)} ${space(3)} 0;
  border-top: 1px solid ${p => p.theme.borderLighter};
  transition: all 5s ease-in-out;

  /* For "Show More" animation */
  ${p => p.isRevealed && `max-height: 50000px`};

  ${p =>
    p.isClipped &&
    `
    max-height: ${p.clipHeight}px;
    overflow: hidden;
  `};

  :first-of-type {
    margin-top: -${space(2)};
    border: 0;
  }
`;

const Title = styled('h5')`
  margin-bottom: ${space(2)};
`;

const ClipFade = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40px 0 0;
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.15),
    rgba(255, 255, 255, 1)
  );
  text-align: center;
  border-bottom: ${space(1.5)} solid ${p => p.theme.white};
`;
