declare namespace TypeLoader {
  type ComponentDoc = import('react-docgen-typescript').ComponentDoc;

  interface ComponentDocWithFilename extends ComponentDoc {
    filename: string;
    module: string;
  }

  interface TypeLoaderResult {
    props?: Record<string, TypeLoader.ComponentDocWithFilename>;
    exports?: {
      module: string;
      exports: Record<string, {name: string; typeOnly: boolean}>;
    };
  }
}

declare module '!!type-loader!*' {
  const TypeLoaderResult: {
    props: Record<string, TypeLoader.ComponentDocWithFilename>;
    exports: Record<string, {name: string; typeOnly: boolean}[]>;
  };

  export default TypeLoaderResult;
}
