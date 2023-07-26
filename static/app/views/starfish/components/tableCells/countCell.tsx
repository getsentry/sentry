import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type Props = {
  count: number;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
};

export function CountCell({count, containerProps}: Props) {
  return (
    <NumberContainer {...containerProps}>
      {formatAbbreviatedNumber(count)}
    </NumberContainer>
  );
}
