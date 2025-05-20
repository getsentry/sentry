import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function RowLine({children, className}: Props) {
  return (
    <Flex align="center" gap={space(1)} wrap="wrap" className={className}>
      {children}
    </Flex>
  );
}
