import {Component} from 'react';
import {motion} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

type RenderProps = {
  fallCount: number;
  fallingError: React.ReactNode;
  isFalling: boolean;
  triggerFall: (countIt?: boolean) => void;
};

type Props = {
  children: (renderProps: RenderProps) => React.ReactNode;
  onFall?: (fallCount: number) => void;
};

type State = {
  fallCount: number;
  isFalling: boolean;
};

class FallingError extends Component<Props, State> {
  state: State = {
    isFalling: false,
    fallCount: 0,
  };

  triggerFall = (countIt?: boolean) =>
    this.setState(s => {
      const fallCount = s.fallCount + (countIt ? 1 : 0);
      this.props.onFall?.(fallCount);

      return {...s, isFalling: true, fallCount};
    });

  render() {
    const {isFalling, fallCount} = this.state;

    const fallingError = (
      <motion.div
        animate={isFalling ? 'falling' : 'hanging'}
        variants={{
          initial: {
            opacity: 0,
          },
          hanging: {
            originX: '50%',
            originY: '0',
            opacity: [1, 1, 1],
            rotateZ: [8, -8, 8],
            transition: testableTransition({
              repeat: Infinity,
              repeatType: 'loop',
              duration: 4,
            }),
          },
          falling: {
            originY: '50%',
            y: 200,
            rotate: -20,
            scale: 0.5,
            opacity: 0,
            transition: {duration: 3},
            transitionEnd: {
              originY: '0',
              scale: 1,
              rotate: 0,
              y: '-10px',
            },
          },
        }}
        onAnimationComplete={variant =>
          variant === 'falling' && this.setState({isFalling: false})
        }
      >
        {!isFalling ? (
          <svg
            width="38"
            height="77"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => this.triggerFall(true)}
          >
            <path
              d="M17.1 56.4L13.5 73 6 60c-.9.7-1.7 1.4-2.3 2.3C3 63 2.6 64 2.4 65c.6.3 1.3.5 2 .4a1.7 1.7 0 001.6-.9l7.1 11.7c.5.9 1.2 1 1.6-.1.3-1.1 3.5-20 3.5-20l-1 .4zM26.7 54.7L30.2 72l-7.5-12.9c-1 .6-1.7 1.4-2.4 2.3-.6.7-1 1.5-1.2 2.5.6.3 1.2.5 1.9.5a1.7 1.7 0 001.7-1L30.4 75a1.1 1.1 0 001.9-1c-.2-1.5-4.6-19.6-4.6-19.6l-1 .4zM27.7 39.7l2.2-31.4-1.6-1.5c0-.7 0-1.3-.3-2l-.3-.8 1-.2 1 2 .7-4.7 1 .1-.3 4.1L32.5 0l1.2.4-1 4.3 1.4-3 .8.6-1.7 5.8-.8.6-4 32.2-.7-1.2zM11.2 39.2L6.6 11.8l.6-.6v-3l.1-1-1-.4a2 2 0 00-.6 1v1.5L4.4 7.4 4.1 6l.1-1.4-1.2.2-.2 1.5.5 1.6L2 6.8 1 5.3.1 6l.7 1.3-.8.9L1.8 10l2.4 1.9 6.5 29.4.5-2z"
              fill="#2F1D4A"
            />
            <path
              d="M17.2 26.4a1.8 1.8 0 00-1.9 1.7l-4 28.3c-.3 1.4.4 3 2.7 2.4l21.5-5.5c1.2-.3 2.1-1.3 1-3-1-1.8-16.1-21.3-16.9-22.3-.8-1-1.3-1.8-2.4-1.6z"
              fill="#E0557A"
            />
            <path d="M22.8 48.7l-5.6-12 4.3-1.5 2.7 13-1.4.5z" fill="#2F1D4A" />
            <path
              d="M17.9 27l-.3-.3-.2-.3h-.2c-.4 0-.7 0-1 .2l.7.7.2.3a1086 1086 0 0117.2 23v.7a1.4 1.4 0 01-1 .8l-21.5 5.5h-.4c0 .4.3.8.6 1a9139.6 9139.6 0 0122.5-6c.3-.3.6-.6.7-1a2.6 2.6 0 00-.4-2.3c-1-1.7-16-21.2-17-22.3z"
              fill="#9D3565"
            />
            <path
              d="M11.4 57.7a1.6 1.6 0 01-1.3-.3 1.7 1.7 0 01-.4-1.6l1.5-10.3 2.5-18c.2-1.2.7-1.2 1.2-1.3h.5a1.2 1.2 0 01.8.4l1-.2h.2a2.4 2.4 0 00-2.4-1.1h-.2a2.2 2.2 0 00-2 2l-2.6 18-1.4 10.3a2.7 2.7 0 00.6 2.5 2.2 2.2 0 001.6.6l1-.1c-.3-.2-.5-.5-.6-.9z"
              fill="#E0557A"
            />
            <path d="M24.5 53.8a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z" fill="#2F1D4A" />
          </svg>
        ) : (
          <svg width="47" height="77" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M21.1 18.4a1.8 1.8 0 00-1.8 1.7l-4 28.3c-.3 1.4.3 3 2.7 2.4l21.5-5.6c1.1-.3 2-1.3 1-3-1.1-1.7-16.1-21.3-17-22.2-.7-1-1.2-1.9-2.4-1.6z"
              fill="#E0557A"
            />
            <path
              d="M26.8 40.6l-5.7-12 4.4-1.4 2.7 13-1.4.4zM28.6 45.9a1.8 1.8 0 100-3.7 1.8 1.8 0 000 3.7z"
              fill="#2F1D4A"
            />
            <path
              d="M21.9 19l-.3-.3-.3-.4h-.2a3 3 0 00-.9.3l.6.7.3.3a1086 1086 0 0117.2 22.9v.8a1.3 1.3 0 01-1 .7l-21.6 5.6h-.4c.1.4.4.7.7 1a9139.6 9139.6 0 0122.5-6l.7-1a2.5 2.5 0 00-.5-2.4C37.7 39.6 22.7 20 22 19z"
              fill="#9D3565"
            />
            <path
              d="M15.3 49.7a1.6 1.6 0 01-1.3-.3 1.8 1.8 0 01-.3-1.6L15 37.4l2.6-18c.2-1.1.7-1.2 1.2-1.2h.4a1.2 1.2 0 01.9.4 3 3 0 011-.2h.1a2.4 2.4 0 00-2.4-1.2h-.1a2.2 2.2 0 00-2.1 2l-2.6 18-1.4 10.3a2.7 2.7 0 00.6 2.6 2.2 2.2 0 001.6.6c.4 0 .7 0 1-.2-.2-.2-.5-.5-.6-.8z"
              fill="#E0557A"
            />
            <path
              d="M32.3 33L40 2.8 42.3.7l2.7.1 1.6 1.9-1.3.1-1.2-1-1 .2 1.2 1.2-.5.8-1.3-.3L33 34.5l-.8-1.5zM14.4 34.6L1 35.1s-1.3.2-.7 1c.5 1 7.1 10 7.1 10l.9.5c.6 0 1.1-.1 1.7-.3l1 1.5.7-.4-1.2-1.8 1-.4 1.6 2 .6-.6-1.5-2.2 1-.2 1.2.4.5-1.1-1.5-.6-3.8 1L3 36.4l11.4-.7v-1zM22 49l-3.6 16.5-7.6-13c-.9.7-1.7 1.4-2.3 2.3-.7.7-1.1 1.6-1.3 2.5a2 2 0 002 .5c.6 0 1.2-.4 1.6-.9l7 11.7c.4.7 1.5.8 1.7-.1l3.5-20-1 .4z"
              fill="#2F1D4A"
            />
            <path
              d="M31.3 46.5l-1 15.2-12.4 9.5c-.5 1-.9 2.2-1 3.4 0 .7.1 1.4.5 2a4 4 0 002.2-1.5 8 8 0 00.8-2.4L31.2 63a1.7 1.7 0 00.8-1.7l.2-15.2-1 .3z"
              fill="#2F1D4A"
            />
          </svg>
        )}
      </motion.div>
    );

    return this.props.children({
      fallCount,
      fallingError,
      triggerFall: this.triggerFall,
      isFalling,
    });
  }
}

export default FallingError;
