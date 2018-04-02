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
      ${styles.paddingLeft(size)};
      ${styles.paddingRight(size)};
    `,
  marginVertical: size =>
    css`
      ${styles.paddingTop(size)};
      ${styles.paddingBottom(size)};
    `,
  marginAll: size =>
    css`
      ${styles.paddingHorizontal(size)};
      ${styles.paddingVertical(size)};
    `,
};

export default styles;
