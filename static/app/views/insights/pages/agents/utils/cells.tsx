import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {Placeholder} from 'sentry/components/placeholder';
import {IconFire} from 'sentry/icons';

export function ErrorCell({
  value,
  target,
  isLoading,
}: {
  value: number;
  isLoading?: boolean;
  target?: string;
}) {
  if (isLoading) {
    return <NumberPlaceholder />;
  }
  if (value === 0 || isNaN(value)) {
    return (
      <Text tabular variant="muted">
        0
      </Text>
    );
  }
  const count = (
    <Text tabular variant="danger">
      <Count value={value} />
    </Text>
  );
  return (
    <Flex align="center" gap="xs">
      {target ? <Link to={target}>{count}</Link> : count}
      <IconFire size="xs" variant="danger" />
    </Flex>
  );
}

export function NumberPlaceholder() {
  return <Placeholder style={{marginLeft: 'auto'}} height="14px" width="50px" />;
}
