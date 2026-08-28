declare namespace TypeLoader {
  type ComponentDoc = import('react-docgen-typescript').ComponentDoc;

  interface TypeLoaderResult {
    props?: Record<string, TypeLoader.ComponentDoc>;
    exports?: {
      module?: string;
      exports?: Record<string, {name: string; typeOnly: boolean}>;
    };
  }
}

declare module '!!type-loader!*' {
  const TypeLoaderResult: TypeLoader.TypeLoaderResult;

  export default TypeLoaderResult;
}
