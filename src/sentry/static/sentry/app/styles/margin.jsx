import {css} from 'react-emotion';
import spacingScale from './spacingScale';

const styles = {
  marginLeft: size =>
    css`
      margin-left: ${spacingScale(size)}px;
    `,
  marginRight: size =>
    css`
      margin-right: ${spacingScale(size)}px;
    `,
  marginTop: size =>
    css`
      margin-top: ${spacingScale(size)}px;
    `,
  marginBottom: size =>
    css`
      margin-bottom: ${spacingScale(size)}px;
    `,
  marginHorizontal: size =>
    css`
      ${styles.marginLeft(size)};
      ${styles.marginRight(size)};
    `,
  marginVertical: size =>
    css`
      ${styles.marginTop(size)};
      ${styles.marginBottom(size)};
    `,
  margin: (size, horizontal, bottom, left) =>
    css`
      ${styles.marginTop(size)};
      ${styles.marginRight(horizontal || size)};
      ${styles.marginBottom(bottom || size)};
      ${styles.marginLeft(left || horizontal || size)};
    `,
};

export default styles;
