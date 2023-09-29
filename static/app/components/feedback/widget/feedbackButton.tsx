import styled from '@emotion/styled';
import classNames from 'classnames';

const THEME = {
  light: {
    foreground: '#2B2233',
  },
  dark: {
    foreground: '#EBE6EF',
  },
};

const Button = styled('button')`
  --sentry-feedback-bg-color: #fff;
  --sentry-feedback-bg-hover-color: #f6f6f7;
  --sentry-feedback-fg-color: ${THEME.light.foreground};
  --sentry-feedback-border: 1.5px solid rgba(41, 35, 47, 0.13);
  --sentry-feedback-box-shadow: 0px 4px 24px 0px rgba(43, 34, 51, 0.12);

  &.__sntry_fdbk_dark {
    --sentry-feedback-bg-color: #29232f;
    --sentry-feedback-bg-hover-color: #352f3b;
    --sentry-feedback-fg-color: ${THEME.dark.foreground};
    --sentry-feedback-border: 1.5px solid rgba(235, 230, 239, 0.15);
    --sentry-feedback-box-shadow: 0px 4px 24px 0px rgba(43, 34, 51, 0.12);
  }

  position: fixed;
  right: 1rem;
  bottom: 1rem;

  display: flex;
  align-items: center;
  gap: 8px;

  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px;
  text-decoration: none;
  z-index: 9000;

  &:hover {
    background-color: var(--sentry-feedback-bg-hover-color);
  }

  svg {
    width: 16px;
    height: 16px;
  }

  color: var(--sentry-feedback-fg-color);
  background-color: var(--sentry-feedback-bg-color);
  border: var(--sentry-feedback-border);
  box-shadow: var(--sentry-feedback-box-shadow);
`;

const ButtonText = styled('span')`
  @media (max-width: 576px) {
    display: none;
  }
`;

interface FeedbackButtonProps extends React.ComponentProps<typeof Button> {
  widgetTheme?: 'dark' | 'light';
}

export function FeedbackButton({widgetTheme = 'light', ...props}: FeedbackButtonProps) {
  const isDarkTheme = widgetTheme === 'dark';
  const iconFillColor = isDarkTheme ? THEME.dark.foreground : THEME.light.foreground;
  return (
    <Button
      className={classNames(props.className, isDarkTheme ? '__sntry_fdbk_dark' : '')}
      {...props}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clipPath="url(#clip0_57_80)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M15.6622 15H12.3997C12.2129 14.9959 12.031 14.9396 11.8747 14.8375L8.04965 12.2H7.49956V19.1C7.4875 19.3348 7.3888 19.5568 7.22256 19.723C7.05632 19.8892 6.83435 19.9879 6.59956 20H2.04956C1.80193 19.9968 1.56535 19.8969 1.39023 19.7218C1.21511 19.5467 1.1153 19.3101 1.11206 19.0625V12.2H0.949652C0.824431 12.2017 0.700142 12.1783 0.584123 12.1311C0.468104 12.084 0.362708 12.014 0.274155 11.9255C0.185602 11.8369 0.115689 11.7315 0.0685419 11.6155C0.0213952 11.4995 -0.00202913 11.3752 -0.00034808 11.25V3.75C-0.00900498 3.62067 0.0092504 3.49095 0.0532651 3.36904C0.0972798 3.24712 0.166097 3.13566 0.255372 3.04168C0.344646 2.94771 0.452437 2.87327 0.571937 2.82307C0.691437 2.77286 0.82005 2.74798 0.949652 2.75H8.04965L11.8747 0.1625C12.031 0.0603649 12.2129 0.00407221 12.3997 0H15.6622C15.9098 0.00323746 16.1464 0.103049 16.3215 0.278167C16.4966 0.453286 16.5964 0.689866 16.5997 0.9375V3.25269C17.3969 3.42959 18.1345 3.83026 18.7211 4.41679C19.5322 5.22788 19.9878 6.32796 19.9878 7.47502C19.9878 8.62209 19.5322 9.72217 18.7211 10.5333C18.1345 11.1198 17.3969 11.5205 16.5997 11.6974V14.0125C16.6047 14.1393 16.5842 14.2659 16.5395 14.3847C16.4948 14.5035 16.4268 14.6121 16.3394 14.7042C16.252 14.7962 16.147 14.8698 16.0307 14.9206C15.9144 14.9714 15.7891 14.9984 15.6622 15ZM1.89695 10.325H1.88715V4.625H8.33715C8.52423 4.62301 8.70666 4.56654 8.86215 4.4625L12.6872 1.875H14.7247V13.125H12.6872L8.86215 10.4875C8.70666 10.3835 8.52423 10.327 8.33715 10.325H2.20217C2.15205 10.3167 2.10102 10.3125 2.04956 10.3125C1.9981 10.3125 1.94708 10.3167 1.89695 10.325ZM2.98706 12.2V18.1625H5.66206V12.2H2.98706ZM16.5997 9.93612V5.01393C16.6536 5.02355 16.7072 5.03495 16.7605 5.04814C17.1202 5.13709 17.4556 5.30487 17.7425 5.53934C18.0293 5.77381 18.2605 6.06912 18.4192 6.40389C18.578 6.73866 18.6603 7.10452 18.6603 7.47502C18.6603 7.84552 18.578 8.21139 18.4192 8.54616C18.2605 8.88093 18.0293 9.17624 17.7425 9.41071C17.4556 9.64518 17.1202 9.81296 16.7605 9.90191C16.7072 9.91509 16.6536 9.9265 16.5997 9.93612Z"
            fill={iconFillColor}
          />
        </g>
        <defs>
          <clipPath id="clip0_57_80">
            <rect width="20" height="20" fill="white" />
          </clipPath>
        </defs>
      </svg>
      <ButtonText>Report a Bug</ButtonText>
    </Button>
  );
}
