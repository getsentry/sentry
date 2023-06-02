import {GettingStartedWithProjectContextProvider} from './gettingStartedWithProjectContext';

type Props = {
  children: React.ReactNode;
};

export default function Projects({children}: Props) {
  return (
    <GettingStartedWithProjectContextProvider>
      {children}
    </GettingStartedWithProjectContextProvider>
  );
}
