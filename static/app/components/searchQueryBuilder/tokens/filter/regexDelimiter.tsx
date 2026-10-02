import {Text} from '@sentry/scraps/text';

export function RegexDelimiter(props: {onMouseDown?: React.MouseEventHandler}) {
  return (
    <Text aria-hidden variant="muted" {...props}>
      /
    </Text>
  );
}
