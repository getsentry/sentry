import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

type Variant = 'small' | 'large';

type Props = {
  /**
   * The value of the progress indicator for the determinate variant. Value between 0 and 100
   */
  value: number;
  /**
   * Styles applied to the component's root
   */
  className?: string;
  /**
   * The style of the progressBar
   */
  variant?: Variant;
};

const getVariantStyle = ({
  variant = 'small',
  theme,
}: Pick<Props, 'variant'> & {theme: Theme}) => {
  if (variant === 'large') {
    return `
      height: 24px;
      border-radius: 24px;
      border: 1px solid ${theme.border};
      box-shadow: inset 0px 1px 3px rgba(0, 0, 0, 0.06);
      :before {
        left: 6px;
        right: 6px;
        height: 14px;
        top: calc(50% - 14px/2);
        border-radius: 20px;
        max-width: calc(100% - 12px);
      }
    `;
  }

  return `
    height: 6px;
    border-radius: 100px;
    background: ${theme.progressBackground};
    :before {
      top: 0;
      left: 0;
      height: 100%;
    }
  `;
};

const ProgressBar = styled(({className, value}: Props) => (
  <div
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
    className={className}
  />
))`
  width: 100%;
  overflow: hidden;
  position: relative;
  :before {
    content: ' ';
    width: ${p => p.value}%;
    background-color: ${p => p.theme.progressBar};
    position: absolute;
  }

  ${getVariantStyle};
`;

export default ProgressBar;
