import {createContext, useContext} from 'react';

type CreateContextReturn<T> = [React.Provider<T>, () => T, React.Context<T>];

/**
 * Creates provider, context and useContext hook, guarding against calling
 * useContext without a provider.
 *
 * [0]: https://github.com/chakra-ui/chakra-ui/blob/c0f9c287df0397e2aa9bd90eb3d5c2f2c08aa0b1/packages/utils/src/react-helpers.ts#L27
 *
 * Renamed to createDefinedContext to not conflate with React context.
 */
export function createDefinedContext<ContextType>(options: {
  name: string;
  errorMessage?: string;
  strict?: boolean;
}) {
  const {
    strict = true,
    errorMessage = `useContext for "${options.name}" must be inside a Provider with a value`,
    name,
  } = options;

  const Context = createContext<ContextType | undefined>(undefined);

  Context.displayName = name;

  function useDefinedContext() {
    const context = useContext(Context);
    if (!context && strict) {
      throw new Error(errorMessage);
    }
    return context;
  }

  return [
    Context.Provider,
    useDefinedContext,
    Context,
  ] as CreateContextReturn<ContextType>;
}
