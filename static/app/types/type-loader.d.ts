declare module '!!type-loader!*' {
  const content: Record<string, TypeLoader.ComponentDocWithFilename>;

  export default content;
}

declare namespace TypeLoader {
  type ComponentDoc = import('react-docgen-typescript').ComponentDoc;
  interface ComponentDocWithFilename extends ComponentDoc {
    filename: string;
  }
}
