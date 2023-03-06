import {PureComponent} from 'react';
import {findDOMNode} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type DefaultProps = {
  btnText?: string;
  /**
   * The "show more" button is 28px tall.
   * Do not clip if there is only a few more pixels
   */
  clipFlex?: number;
  clipHeight?: number;
  defaultClipped?: boolean;
};

type Props = {
  clipFlex: number;
  clipHeight: number;
  className?: string;
  /**
   * When available replaces the default clipFade component
   */
  clipFade?: ({showMoreButton}: {showMoreButton: React.ReactNode}) => React.ReactNode;
  /**
   * Triggered when user clicks on the show more button
   */
  onReveal?: () => void;
  /**
   * Its trigged when the component is mounted and its height available
   */
  onSetRenderedHeight?: (renderedHeight: number) => void;
  renderedHeight?: number;
  title?: string;
} & DefaultProps;

type State = {
  isClipped: boolean;
  isRevealed: boolean;
  renderedHeight?: number;
};

class ClippedBox extends PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    defaultClipped: false,
    clipHeight: 200,
    clipFlex: 28,
    btnText: t('Show More'),
  };

  state: State = {
    isClipped: !!this.props.defaultClipped,
    isRevealed: false, // True once user has clicked "Show More" button
    renderedHeight: this.props.renderedHeight,
  };

  componentDidMount() {
    // eslint-disable-next-line react/no-find-dom-node
    const renderedHeight = (findDOMNode(this) as HTMLElement).offsetHeight;
    this.props.onSetRenderedHeight?.(renderedHeight);
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
      const renderedHeight = (findDOMNode(this) as HTMLElement).offsetHeight;

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

    if (
      !this.state.isClipped &&
      renderedHeight > this.props.clipHeight + this.props.clipFlex
    ) {
      /* eslint react/no-did-mount-set-state:0 */
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
    const {title, children, clipHeight, btnText, className, clipFade} = this.props;

    const showMoreButton = (
      <Button
        onClick={this.reveal}
        priority="primary"
        size="xs"
        aria-label={btnText ?? t('Show More')}
      >
        {btnText}
      </Button>
    );

    return (
      <Wrapper
        clipHeight={clipHeight}
        isClipped={isClipped}
        isRevealed={isRevealed}
        className={className}
      >
        {title && <Title>{title}</Title>}
        {children}
        {isClipped &&
          (clipFade?.({showMoreButton}) ?? <ClipFade>{showMoreButton}</ClipFade>)}
      </Wrapper>
    );
  }
}

export default ClippedBox;

const Wrapper = styled('div', {
  shouldForwardProp: prop =>
    prop !== 'clipHeight' && prop !== 'isClipped' && prop !== 'isRevealed',
})<State & {clipHeight: number}>`
  position: relative;
  padding: ${space(1.5)} 0;

  /* For "Show More" animation */
  ${p =>
    p.isRevealed &&
    css`
      transition: all 5s ease-in-out;
      max-height: 50000px;
    `};

  ${p =>
    p.isClipped &&
    css`
      max-height: ${p.clipHeight}px;
      overflow: hidden;
    `};
`;

const Title = styled('h5')`
  margin-bottom: ${space(1)};
`;

const ClipFade = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40px 0 0;
  background-image: linear-gradient(
    180deg,
    ${p => color(p.theme.background).alpha(0.15).string()},
    ${p => p.theme.background}
  );
  text-align: center;
  border-bottom: ${space(1.5)} solid ${p => p.theme.background};
  /* Let pointer-events pass through ClipFade to visible elements underneath it */
  pointer-events: none;
  /* Ensure pointer-events trigger event listeners on "Expand" button */
  > * {
    pointer-events: auto;
  }
`;
