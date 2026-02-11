// Reference: https://github.com/Microsoft/TypeScript-React-Starter/issues/12#issuecomment-327860151
// TS compatibility for https://github.com/webpack-contrib/file-loader

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.mp4';
declare module '*.woff';
declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.pegjs' {
  import type {Parser} from 'peggy';
  export const parse: Parser['parse'];
  export const SyntaxError: Parser['SyntaxError'];
  export const StartRules: Parser['StartRules'];
}
