import {Link} from 'sentry/components/core/link';
import Placeholder from 'sentry/components/placeholder';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';

export function ErrorCell({
  value,
  target,
  isLoading,
}: {
  target: string;
  value: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <NumberPlaceholder />;
  }
  if (value === 0 || isNaN(value)) {
    return <TextAlignRight>0</TextAlignRight>;
  }
  return (
    <TextAlignRight>
      <Link to={target}>{value}</Link>
    </TextAlignRight>
  );
}

export function NumberPlaceholder() {
  return <Placeholder style={{marginLeft: 'auto'}} height="14px" width="50px" />;
}
