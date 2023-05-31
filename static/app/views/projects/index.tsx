import {GettingStartedWithProjectContextProvider} from './gettingStartedWithProjectContext';

type Props = {
  children: React.ReactNode;
};

export function Projects({children}: Props) {
  return (
    <GettingStartedWithProjectContextProvider>
      {children}
    </GettingStartedWithProjectContextProvider>
  );
}
