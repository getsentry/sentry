import {css} from 'react-emotion';
import spacingScale from './spacingScale';

const styles = {
  paddingLeft: size =>
    css`
      padding-left: ${spacingScale(size)}px;
    `,
  paddingRight: size =>
    css`
      padding-right: ${spacingScale(size)}px;
    `,
  paddingTop: size =>
    css`
      padding-top: ${spacingScale(size)}px;
    `,
  paddingBottom: size =>
    css`
      padding-bottom: ${spacingScale(size)}px;
    `,
  paddingHorizontal: size =>
    css`
      ${styles.paddingLeft(size)};
      ${styles.paddingRight(size)};
    `,
  paddingVertical: size =>
    css`
      ${styles.paddingTop(size)};
      ${styles.paddingBottom(size)};
    `,
  paddingBoth: (vertical, horizontal) => css`
    ${styles.paddingVertical(vertical)};
    ${styles.paddingHorizontal(horizontal || vertical)};
  `,
};

export default styles;
