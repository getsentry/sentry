declare namespace TypeLoader {
  type PropDoc = Pick<
    import('react-docgen-typescript').PropItem,
    'name' | 'description' | 'required' | 'parent'
  > & {
    type: Pick<import('react-docgen-typescript').PropItemType, 'name' | 'raw'>;
  };

  interface ComponentDoc {
    description: string;
    displayName: string;
    props: Record<string, PropDoc>;
  }

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
