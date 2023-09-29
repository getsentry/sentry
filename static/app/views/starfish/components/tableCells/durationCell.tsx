import Duration from 'sentry/components/duration';
import {t} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';

type Props = {
  milliseconds: number;
  containerProps?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >;
};

export function DurationCell({milliseconds, containerProps}: Props) {
  const undefinedDurationText = `--${t('ms')}`;

  return (
    <NumberContainer {...containerProps}>
      {milliseconds >= 0 ? (
        <Duration seconds={milliseconds / 1000} fixedDigits={2} abbreviation />
      ) : (
        undefinedDurationText
      )}
    </NumberContainer>
  );
}
