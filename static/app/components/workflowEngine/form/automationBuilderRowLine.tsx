import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';

export function RowLine({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" gap={space(1)}>
      {children}
    </Flex>
  );
}
