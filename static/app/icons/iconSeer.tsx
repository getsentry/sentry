import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconSeer(props: SVGIconProps) {
  return (
    <SvgIcon {...props} kind="path">
      <path
        d="M5.48452 0.727456L0.842018 6.88496C0.707018 7.05746 0.737018 7.31246 0.909518 7.44746L5.55952 11.295C5.70952 11.4225 5.93452 11.4225 6.08452 11.295L10.727 7.44746C10.8995 7.30496 10.9295 7.05746 10.7945 6.88496L6.14452 0.727456C5.97952 0.509956 5.64952 0.509956 5.48452 0.727456Z"
        stroke="white"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.52937 4.79251L3.26437 6.59251C3.11437 6.71251 3.12187 6.89251 3.28687 7.00501C3.28687 7.00501 5.40937 8.46752 5.55187 8.57252C5.70187 8.67752 5.92687 8.67752 6.07687 8.57252L8.35687 7.00501C8.51437 6.89251 8.52187 6.71251 8.37937 6.59251L6.09937 4.79251C5.94937 4.67251 5.68687 4.67251 5.53687 4.79251H5.52937Z"
        stroke="white"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.79956 6.39746V6.95996"
        stroke="white"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

IconSeer.displayName = 'IconSeer';

export {IconSeer};
