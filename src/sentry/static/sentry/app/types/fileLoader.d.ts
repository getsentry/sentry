// Reference: https://github.com/Microsoft/TypeScript-React-Starter/issues/12#issuecomment-327860151
// TS compatibility for https://github.com/webpack-contrib/file-loader

declare module '*.png';
declare module '*.jpg';
declare module '*.mp4';
declare module '*.svg' {
  const content: any;
  export default content;
}
