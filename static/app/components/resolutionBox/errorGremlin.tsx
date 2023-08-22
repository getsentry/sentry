import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion, useAnimation, Variants} from 'framer-motion';

type ErrorGemlinProps = {onEndJump: () => void; onEndRun: () => void};

const ANIMATION_DURATION = '500ms';
const JUMP_DURATION = '400ms';

const animationVariants: Variants = {
  start: {x: 1000, y: 0},
  running: {x: 30, y: 0, transition: {duration: 2, ease: 'easeInOut'}},
  jump: {x: 0, y: -40},
  fall: {x: 0, y: 40},
};

const bodyVariants: Variants = {
  start: {x: 0, y: 0},
  running: {
    x: 0,
    y: 10,
    transition: {
      repeat: Infinity,
      repeatType: 'mirror',
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
  jump: {
    rotate: 30,
  },
  fall: {
    rotate: 60,
  },
};

export function ErrorGemlin({onEndRun, onEndJump}: ErrorGemlinProps) {
  // const controls = useAnimation();
  const [animationClass, setAnimationClass] = useState('running');

  // useEffect(() => {
  //   const animation = async () => {
  //     // await controls.start('running');
  //     await controls.start('running');
  //     console.log('done running');
  //     setAnimationClass('jumping');
  //     await controls.start('jump');
  //     console.log('done jump');
  //     await controls.start('fall');
  //     console.log('done fall');
  //     // animate('li', {opacity: 1});
  //   };

  //   animation();
  // }, [controls]);

  return (
    <AnimatedSvg
      xmlns="http://www.w3.org/2000/svg"
      width={50}
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      viewBox="0 -35 60 110"
      initial="start"
      // animate={controls}
      // variants={animationVariants}
      className={animationClass}
      onAnimationEnd={e => {
        switch (e.animationName) {
          case 'move':
            setAnimationClass('jumping');
            onEndRun();
            break;
          case 'jump-horizontal':
            onEndJump();
            break;
          default:
        }
      }}
    >
      <g id="gremlin-container">
        <motion.g id="gremlin">
          <g id="right-arm">
            <polyline
              points="116.2624,20.005 109.7105,27.3815 103.9094,22.5728 104.9186,21.4037 100.2651,17.0929 99.4013,18.4721 99.6615,19.5195 97.9384,22.6531 100.9509,24.4724 109.8549,30.0042 116.371,21.7757"
              fill="#ece8f0"
              id="polyline1"
              transform="translate(-89.54559,15.550236)"
            />
            <path
              d="m 20.361014,46.433366 c -0.0811,0 -0.1621,-0.0215 -0.2344,-0.0669 l -11.9120999,-7.3481 c -0.2041,-0.123 -0.2743992,-0.3853 -0.1592,-0.5938 l 1.6396009,-2.9814 -0.2188,-0.8784 c -0.0293,-0.1172 -0.01,-0.2412 0.0547,-0.3433 l 0.8643,-1.3794 c 0.0703,-0.1118 0.1865,-0.187 0.3174,-0.2041 0.1299,-0.0215 0.2627,0.0244 0.3604,0.1143 l 4.6533,4.311 c 0.1758,0.1626 0.1904,0.4346 0.0342,0.6157 l -0.7129,0.8262 5.122099,4.2461 6.2666,-7.0562 c 0.1631,-0.1836 0.4443,-0.1997 0.627,-0.0371 0.1836,0.1631 0.2002,0.4434 0.0371,0.627 l -6.5518,7.377 c -0.1602,0.1802 -0.4316,0.1997 -0.6152,0.0469 l -5.800799,-4.8091 c -0.0918,-0.0762 -0.1494,-0.186 -0.1592,-0.3047 -0.01,-0.1191 0.0283,-0.2368 0.1064,-0.3271 l 0.7285,-0.8447 -3.9453,-3.6553 -0.4795,0.7651 0.2148,0.8643 c 0.0273,0.1089 0.0127,0.2236 -0.042,0.3213 l -1.5176,2.7603 2.6475,1.5991 8.572299,5.3252 6.2705,-7.918 c 0.1514,-0.1919 0.4336,-0.2236 0.623,-0.0723 0.1924,0.1523 0.2246,0.4316 0.0723,0.624 l -6.5156,8.228 c -0.0869,0.1104 -0.2158,0.1685 -0.3477,0.1685 z"
              fill="#2f1d4a"
              id="right-arm-outline"
            />
            <path
              d="m 12.353215,39.116936 c -0.0967,0 -0.1943,-0.0312 -0.2764,-0.0962 l -1.5303,-1.2158 c -0.1064,-0.085 -0.168,-0.2139 -0.168,-0.3496 10e-4,-0.1362 0.0645,-0.2646 0.1719,-0.3481 l 2.3252,-1.8105 c 0.1914,-0.1514 0.4707,-0.1172 0.623,0.0771 0.1504,0.1938 0.1152,0.4727 -0.0781,0.623 l -1.8799,1.4639 0.7461,0.5923 0.6748,-0.8271 c 0.1553,-0.1899 0.4326,-0.2188 0.625,-0.063 0.1895,0.1548 0.2178,0.4346 0.0625,0.6245 l -0.9521,1.1665 c -0.0879,0.1074 -0.2148,0.1631 -0.3438,0.1631 z"
              fill="#2f1d4a"
              id="right-fist"
            />
          </g>
          <path
            d="m 31.4,47.6 c 0,0 0.4,11.8 0.4,11.8 -0,0.3 0.2,0.7 0.7,0.8 0,0 13.7,2.3 13.7,2.3 0.1,0.9 0.9,2.4 1.7,2.9 0,0 1.8,-0.9 1.8,-5.9 0,0 -15.8,-1.5 -15.8,-1.5 l -1.4,-10.6 c -0.3,-0.4 -0.9,-0.5 -1.1,0.1 z"
            fill="#ece8f0"
            stroke="#2f1d4a"
            strokeLinecap="round"
            strokeLinejoin="round"
            id="right-leg"
          />
          <path
            id="left-leg"
            d="M 31.4,47.6 C 31.4,47.6,31.8,59.4,31.8,59.4 C 31.8,59.4,31.8,59.4,31.8,59.4 C 31.8,59.4,31.6,73,31.6,73 C 30.7,73.5,29.4,74.1,29,75.1 C 29,75.1,30.7,76.8,35.1,75.9 C 35.1,75.9,33.7,59.4,33.7,59.4 L 32.5,47.5 C 32.2,47,31.6,47,31.4,47.6 Z"
            fill="#ece8f0"
            stroke="#2f1d4a"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g id="gremlin-body">
            <path
              d="m 27.743424,24.688512 -5.5496,23.5303 c -0.0676,0.2866 0.3176,0.6164 0.7059,0.6063 l 24.7162,-0.6428 c 0.6434,-0.0167 1.0757,-0.4727 0.7772,-0.8333 l -19.1186,-23.0978 c -0.4743,-0.573 -1.3535,-0.3153 -1.531,0.4373 z"
              fill="#ebb432"
              id="body-fill"
            />
            <path
              d="m 22.682324,49.147012 c -0.3135,0 -0.625,-0.1479 -0.8203,-0.3911 -0.1582,-0.1968 -0.2168,-0.4365 -0.1611,-0.6577 l 6.3037,-25.1201 c 0.1221,-0.4854 0.4834,-0.8496 0.9443,-0.9507 0.4287,-0.0938 0.8369,0.0566 1.1113,0.3979 l 19.6611,24.5239 c 0.1846,0.2314 0.2217,0.5278 0.0996,0.7925 -0.167,0.3618 -0.5977,0.6055 -1.0967,0.6206 l -26.0107,0.7842 c -0.0107,5e-4 -0.0205,5e-4 -0.0312,5e-4 z m -0.1201,-0.8325 v 5e-4 z m 0.0225,-0.0884 c 0.0273,0.0176 0.0576,0.0308 0.1016,0.0327 l 26.0107,-0.7842 c 0.1162,-0.0034 0.2021,-0.0337 0.2568,-0.063 l -19.5869,-24.4307 c -0.0615,-0.0771 -0.1436,-0.1055 -0.2275,-0.0859 -0.1016,0.022 -0.2266,0.1123 -0.2734,0.2988 v 0 l -6.2812,25.0322 z m 5.8506,-25.1953 h 0.01 z"
              fill="#2f1d4a"
              id="body-outline"
            />
            <polygon
              points="121.3446,14.9985 123.7864,14.5629 124.6765,23.3143 123.2968,23.4974 "
              transform="translate(-92.17058,16.372603)"
              fill="#2f1d4a"
              id="exclamation"
            />
            <path
              d="m 33.117324,42.992812 c 0.143,0.6253 -0.2407,1.26 -0.8529,1.4234 -0.6092,0.1627 -1.2249,-0.2006 -1.3794,-0.8169 -0.1563,-0.6235 0.2166,-1.2728 0.8374,-1.4444 0.6238,-0.1725 1.2502,0.2054 1.3949,0.838 z"
              fill="#2f1d4a"
              id="exclamation-dot"
            />
          </g>
          <g id="left-arm">
            <polyline
              points="133.201,19.4731 140.3666,23.6182 136.9467,30.3324 135.5848,29.6041 132.3992,35.0895 133.9341,35.6299 134.899,35.1464 138.3342,36.1406 139.4487,32.8025 142.8938,22.9023 133.299507,18.4721"
              fill="#ece8f0"
              id="left-arm-fill"
              transform="translate(-93.52334,17.653776)"
            />
            <path
              d="m 44.853464,54.238576 c -0.041,0 -0.082,-0.0059 -0.123,-0.0176 l -3.2686,-0.9463 -0.8096,0.4058 c -0.1074,0.0542 -0.2334,0.0615 -0.3467,0.022 l -1.5352,-0.54 c -0.125,-0.0439 -0.2236,-0.1411 -0.2695,-0.2651 -0.0449,-0.1245 -0.0332,-0.2622 0.0332,-0.377 l 3.1855,-5.4854 c 0.1191,-0.2065 0.3818,-0.2808 0.5928,-0.1685 l 0.9629,0.5146 3.0205,-5.9297 -6.9512,-3.875 c -0.2148,-0.1191 -0.291,-0.3896 -0.1719,-0.604 0.1191,-0.2144 0.3906,-0.29 0.6035,-0.1714 l 7.3252,4.083 c 0.209,0.1162 0.2881,0.3765 0.1797,0.5894 l -3.4199,6.7144 c -0.0537,0.106 -0.1484,0.186 -0.2627,0.2222 -0.1123,0.0361 -0.2373,0.0234 -0.3418,-0.0322 l -0.9844,-0.5259 -2.7012,4.6509 0.8516,0.2993 0.7959,-0.3989 c 0.0996,-0.0503 0.2148,-0.0591 0.3223,-0.0298 l 3.0264,0.876 0.9795,-2.9336 3.3193,-9.5405 -9.0899,-4.6494 c -0.2178,-0.111799 -0.1113,-0.1323 0,-0.3511 0.1113,-0.2183 1.12183,0.2413 1.33673,0.3511 l 8.50217,4.0346 c 0.1973,0.1011 0.29,0.332 0.2168,0.5415 l -4.5576,13.2329 c -0.0615,0.1851 -0.2344,0.3037 -0.4209,0.3037 z"
              fill="#2f1d4a"
              id="left-arm-outline"
            />
          </g>
        </motion.g>
      </g>
    </AnimatedSvg>
  );
}

const AnimatedSvg = styled(motion.svg)`
  margin: 0 !important;
  position: absolute;
  bottom: 2px;
  left: 45px;

  #left-arm {
    transform-origin: 39px 37px;
  }

  #right-arm {
    transform-origin: 28px 37px;
  }

  #right-leg {
    transform-origin: 32px 47.5px;
    transform: rotate(0);
  }

  #left-leg {
    transform-origin: 32px 47.5px;
    transform: translateX(5px) rotate(35deg);
  }

  #gremlin {
    transform-origin: 33px 39px;
  }

  @keyframes move {
    0% {
      opacity: 0;
      left: calc(100% - 50px);
    }
    10% {
      opacity: 1;
    }
    100% {
      left: 45px;
    }
  }

  &.jumping {
    animation: jump-horizontal ${JUMP_DURATION};
    animation-timing-function: ease-in-out;
    left: 10px;

    #gremlin-container {
      animation: jump-vertical ${JUMP_DURATION} cubic-bezier(0.4, -0.08, 0.48, -2.58);
      transform: translateY(40px);
    }

    #gremlin {
      animation: gremlin-rotate ${JUMP_DURATION} ease-out;
      transform: rotate(50deg);
    }

    #left-arm {
      transition: transform ${JUMP_DURATION} ease-out;
      transform: rotate(50deg);
    }

    #right-arm {
      transition: transform ${JUMP_DURATION} ease-out;
      transform: rotate(-50deg);
    }

    #left-leg {
      animation: left-leg-tuck ${JUMP_DURATION} ease-out;
    }

    #right-leg {
      animation: right-leg-tuck ${JUMP_DURATION} ease-out;
    }

    @keyframes jump-horizontal {
      0% {
        left: 45px;
      }
      100% {
        left: 10px;
      }
    }

    @keyframes jump-vertical {
      0% {
        transform: translateY(0);
      }

      100% {
        transform: translateY(40px);
      }
    }

    @keyframes gremlin-rotate {
      0% {
        transform: rotate(0);
      }
      100% {
        transform: rotate(70deg);
      }
    }

    @keyframes right-leg-tuck {
      0% {
        transform: rotate(0);
        d: path(
          'm 31.4,47.6 c 0,0 0.4,11.8 0.4,11.8 -0,0.3 0.2,0.7 0.7,0.8 0,0 13.7,2.3 13.7,2.3 0.1,0.9 0.9,2.4 1.7,2.9 0,0 1.8,-0.9 1.8,-5.9 0,0 -15.8,-1.5 -15.8,-1.5 l -1.4,-10.6 c -0.3,-0.4 -0.9,-0.5 -1.1,0.1 z'
        );
      }
      100% {
        transform: rotate(105deg);
        d: path(
          'M31.405944,47.632615c0,0,.37306,11.797068.37306,11.797068-.0168.27711,0,1.749085,1.544638,1.749085c0,0,11.235082-4.874631,11.235082-4.874631.752987.857615,1.966265,1.807716,3.8344,1.407949c0,0,.095951-4.190168-2.467724-5.903032c0,0-12.014196,6.302799-12.014196,6.302799l-1.41744-10.621065c-.33253-.444254-.85418-.482607-1.08782.141827Z'
        );
      }
    }

    @keyframes left-leg-tuck {
      0% {
        transform: translateX(5px);
        d: path(
          'M 31.4,47.6 C 31.4,47.6,31.8,59.4,31.8,59.4 C 31.8,59.4,31.8,59.4,31.8,59.4 C 31.8,59.4,31.6,73,31.6,73 C 30.7,73.5,29.4,74.1,29,75.1 C 29,75.1,30.7,76.8,35.1,75.9 C 35.1,75.9,33.7,59.4,33.7,59.4 L 32.5,47.5 C 32.2,47,31.6,47,31.4,47.6 Z'
        );
      }
      100% {
        transform: translateX(5px) rotate(105deg);
        d: path(
          'M31.405944,47.632615c0,0,.37306,11.797068.37306,11.797068-.0168.27711,0,1.749085,1.544638,1.749085c0,0,11.235082-4.874631,11.235082-4.874631.752987.857615,1.966265,1.807716,3.8344,1.407949c0,0,.095951-4.190168-2.467724-5.903032c0,0-12.014196,6.302799-12.014196,6.302799l-1.41744-10.621065c-.33253-.444254-.85418-.482607-1.08782.141827Z'
        );
      }
    }
  }

  &.running {
    animation: move 2s;
    animation-timing-function: ease-in-out;

    #gremlin {
      animation: bounce ${ANIMATION_DURATION} ease-out;
      animation-iteration-count: infinite;
    }

    @keyframes bounce {
      0%,
      25%,
      50%,
      75%,
      100% {
        transform: translateY(0);
      }
      12.5%,
      62.5% {
        transform: translateY(5px);
      }
      37.5%,
      87.5% {
        transform: translateY(-5px);
      }
    }

    #left-arm {
      animation: rotate-left-arm infinite ${ANIMATION_DURATION};
    }

    @keyframes rotate-left-arm {
      0%,
      100% {
        transform: rotate(0);
      }
      50% {
        transform: rotate(90deg);
      }
    }

    #right-arm {
      animation: rotate-right-arm infinite ${ANIMATION_DURATION};
    }

    @keyframes rotate-right-arm {
      0%,
      100% {
        transform: rotate(0);
      }
      50% {
        transform: rotate(-90deg);
      }
    }

    #right-leg {
      animation: right-leg-run linear infinite ${ANIMATION_DURATION};
    }

    #left-leg {
      animation: left-leg-run linear infinite ${ANIMATION_DURATION};
    }

    @keyframes right-leg-run {
      0%,
      100% {
        transform: rotate(0);
        d: path(
          'm 31.4,47.6 c 0,0 0.4,11.8 0.4,11.8 -0,0.3 0.2,0.7 0.7,0.8 0,0 13.7,2.3 13.7,2.3 0.1,0.9 0.9,2.4 1.7,2.9 0,0 1.8,-0.9 1.8,-5.9 0,0 -15.8,-1.5 -15.8,-1.5 l -1.4,-10.6 c -0.3,-0.4 -0.9,-0.5 -1.1,0.1 z'
        );
      }
      50% {
        transform: rotate(35deg);
        d: path(
          'M 31.4,47.6 C 31.4,47.6,31.8,59.4,31.8,59.4 C 31.8,59.4,31.8,59.4,31.8,59.4 C 31.8,59.4,31.6,73,31.6,73 C 30.7,73.5,29.4,74.1,29,75.1 C 29,75.1,30.7,76.8,35.1,75.9 C 35.1,75.9,33.7,59.4,33.7,59.4 L 32.5,47.5 C 32.2,47,31.6,47,31.4,47.6 Z'
        );
      }
    }

    @keyframes left-leg-run {
      0%,
      100% {
        transform: translateX(5px) rotate(35deg);
        d: path(
          'M 31.4,47.6 C 31.4,47.6,31.8,59.4,31.8,59.4 C 31.8,59.4,31.8,59.4,31.8,59.4 C 31.8,59.4,31.6,73,31.6,73 C 30.7,73.5,29.4,74.1,29,75.1 C 29,75.1,30.7,76.8,35.1,75.9 C 35.1,75.9,33.7,59.4,33.7,59.4 L 32.5,47.5 C 32.2,47,31.6,47,31.4,47.6 Z'
        );
      }
      50% {
        transform: translateX(5px) rotate(-10deg);
        d: path(
          'm 31.4,47.6 c 0,0 0.4,11.8 0.4,11.8 -0,0.3 0.2,0.7 0.7,0.8 0,0 13.7,2.3 13.7,2.3 0.1,0.9 0.9,2.4 1.7,2.9 0,0 1.8,-0.9 1.8,-5.9 0,0 -15.8,-1.5 -15.8,-1.5 l -1.4,-10.6 c -0.3,-0.4 -0.9,-0.5 -1.1,0.1 z'
        );
      }
    }
  }
`;
