import {Stack} from '@sentry/scraps/layout';

interface ScmStepContentProps {
  children: React.ReactNode;
}

export function ScmStepContent({children}: ScmStepContentProps) {
  return (
    <Stack gap="lg" width="100%" maxWidth="506px">
      {children}
    </Stack>
  );
}
