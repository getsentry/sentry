import {useContext} from 'react';

import type {FormContextData} from 'sentry/components/deprecatedforms/formContext';
import FormContext from 'sentry/components/deprecatedforms/formContext';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedFormContextProps = {
  formContext?: FormContextData;
};

/**
 * Wrap deprecated form components with form context
 * @deprecated Do not use this
 */
export default function withFormContext<P extends InjectedFormContextProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedFormContextProps> &
    Partial<InjectedFormContextProps>;

  function Wrapper(props: Props) {
    const formContext = useContext(FormContext);

    const allProps = {formContext, ...props} as P;

    return <WrappedComponent {...(allProps as any)} />;
  }

  Wrapper.displayName = `withFormContext(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}
