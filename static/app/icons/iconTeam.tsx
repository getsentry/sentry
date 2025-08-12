import {useTheme} from '@emotion/react';

import {SvgIcon, type SVGIconProps} from 'sentry/icons/svgIcon';

function IconTeam(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      <g clipPath="url(#clip0_2848_12036)">
        <mask
          id="mask0_2848_12036"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="72"
          height="72"
        >
          <path d="M72 0H0V72H72V0Z" fill="white" />
        </mask>
        <g mask="url(#mask0_2848_12036)">
          <path d="M72 0H0V72H72V0Z" fill="white" />
          <path
            d="M38.1374 24.8625C38.1374 20.9482 34.9642 17.775 31.0499 17.775C27.1356 17.775 23.9624 20.9482 23.9624 24.8625V30.9375C23.9624 34.8518 27.1356 38.025 31.0499 38.025C34.9642 38.025 38.1374 34.8518 38.1374 30.9375V24.8625Z"
            stroke="#181423"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M23.9625 38.025H38.1376C42.5926 38.025 46.2375 41.67 46.2375 46.125V58.275H15.8625V46.125C15.8625 41.67 19.5075 38.025 23.9625 38.025Z"
            stroke="#181423"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M43.2 13.725C47.1285 13.725 50.2874 16.884 50.2874 20.8125V26.8875C50.2874 28.8315 49.518 30.573 48.2625 31.8285L50.2874 33.975C54.7424 33.975 58.3875 37.62 58.3875 42.075V54.225H55.3499"
            stroke="#181423"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <defs>
        <clipPath id="clip0_2848_12036">
          <rect width="72" height="72" fill="white" />
        </clipPath>
      </defs>
    </SvgIcon>
  );
}

export {IconTeam};
