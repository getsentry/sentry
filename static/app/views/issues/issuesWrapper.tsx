import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

interface IssuesWrapperProps extends RouteComponentProps<{}, {}> {
  children: React.ReactNode;
}

// TODO(malwilley): Add navigation to the issues module here
export function IssuesWrapper({children}: IssuesWrapperProps) {
  return children;
}
