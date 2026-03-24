import {Flex} from '@sentry/scraps/layout';

interface ScmStepFooterProps {
  children: React.ReactNode;
}

export function ScmStepFooter({children}: ScmStepFooterProps) {
  return (
    <Flex
      gap="lg"
      align="center"
      justify="end"
      width="100%"
      maxWidth="506px"
      paddingTop="3xl"
    >
      {children}
    </Flex>
  );
}
