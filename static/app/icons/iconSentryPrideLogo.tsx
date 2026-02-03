import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconSentryPrideLogo(props: Omit<SVGIconProps, 'fill'>) {
  return (
    <SvgIcon {...props}>
      <defs>
        <linearGradient id="pride" x1="0%" y1="75%" x2="100%" y2="130%">
          <stop offset="0" style={{stopColor: '#DA6B9D', stopOpacity: 1}} />
          <stop offset="0.125" style={{stopColor: '#DA6B9D', stopOpacity: 1}} />
          <stop offset="0.125" style={{stopColor: '#D3382A', stopOpacity: 1}} />
          <stop offset="0.2250" style={{stopColor: '#D3382A', stopOpacity: 1}} />
          <stop offset="0.225" style={{stopColor: '#E38A31', stopOpacity: 1}} />
          <stop offset="0.325" style={{stopColor: '#E38A31', stopOpacity: 1}} />
          <stop offset="0.325" style={{stopColor: '#F2E93D', stopOpacity: 1}} />
          <stop offset="0.425" style={{stopColor: '#F2E93D', stopOpacity: 1}} />
          <stop offset="0.425" style={{stopColor: '#3A8143', stopOpacity: 1}} />
          <stop offset="0.525" style={{stopColor: '#3A8143', stopOpacity: 1}} />
          <stop offset="0.525" style={{stopColor: '#52B0B4', stopOpacity: 1}} />
          <stop offset="0.625" style={{stopColor: '#52B0B4', stopOpacity: 1}} />
          <stop offset="0.625" style={{stopColor: '#3A2A7D', stopOpacity: 1}} />
          <stop offset="0.725" style={{stopColor: '#3A2A7D', stopOpacity: 1}} />
          <stop offset="0.725" style={{stopColor: '#732C7C', stopOpacity: 1}} />
          <stop offset="1" style={{stopColor: '#732C7C', stopOpacity: 1}} />
        </linearGradient>
      </defs>
      <path
        fill="url(#pride)"
        d="M8 0.67C8.26 0.67 8.52 0.74 8.74 0.88C8.97 1.01 9.15 1.2 9.28 1.43L15.8 13.05C15.93 13.28 16 13.54 16 13.81C16 14.01 15.96 14.21 15.89 14.39L15.81 14.59C15.68 14.82 15.5 15.01 15.27 15.14C15.05 15.28 14.79 15.35 14.53 15.35H13V14.08H14.53C14.57 14.08 14.61 14.07 14.65 14.05C14.69 14.03 14.72 14 14.74 13.96C14.76 13.92 14.78 13.88 14.78 13.84C14.78 13.79 14.76 13.75 14.74 13.71L8.22 2.08C8.2 2.04 8.17 2.01 8.13 1.99C8.09 1.97 8.05 1.96 8.01 1.96C7.97 1.96 7.93 1.97 7.89 1.99C7.85 2.01 7.82 2.04 7.8 2.08L6.3 4.75C7.83 5.78 9.1 7.15 10 8.75C11.01 10.57 11.53 12.62 11.52 14.7V15.3H7.58V14.67C7.59 13.3 7.24 11.95 6.58 10.75C6.02 9.75 5.25 8.89 4.32 8.22L3.58 9.54C4.29 10.08 4.88 10.76 5.31 11.54C5.85 12.51 6.13 13.59 6.13 14.7V15.33H1.48C1.22 15.33 0.96 15.26 0.74 15.13C0.51 14.99 0.33 14.8 0.2 14.57C0.07 14.34 -0 14.08 -0 13.81C-0 13.54 0.07 13.28 0.2 13.05L1.14 11.37C1.53 11.51 1.9 11.73 2.21 12L1.27 13.68C1.25 13.72 1.24 13.76 1.24 13.81C1.24 13.85 1.25 13.89 1.27 13.93C1.29 13.97 1.32 14 1.36 14.02C1.4 14.04 1.44 14.05 1.48 14.05H4.86C4.76 13.29 4.49 12.55 4.08 11.91C3.66 11.26 3.1 10.72 2.44 10.32L1.91 10L3.88 6.5L4.41 6.81C5.76 7.62 6.88 8.77 7.65 10.15C8.32 11.35 8.72 12.69 8.81 14.06H10.29C10.19 12.42 9.72 10.82 8.92 9.39C8.03 7.78 6.73 6.44 5.15 5.5L4.61 5.18L6.72 1.43C6.85 1.2 7.03 1.01 7.26 0.88C7.48 0.74 7.74 0.67 8 0.67Z"
      />
    </SvgIcon>
  );
}
