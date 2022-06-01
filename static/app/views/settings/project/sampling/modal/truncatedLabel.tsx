import Truncate from 'sentry/components/truncate';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';

type Props = {
  value: string;
};

export function TruncatedLabel({value}: Props) {
  const isSmallDevice = useMedia(`(max-width: ${theme.breakpoints[0]})`);

  return (
    <Truncate value={value} maxLength={isSmallDevice ? 30 : 40} expandable={false} />
  );
}
