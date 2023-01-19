import ClippedBox from 'sentry/components/clippedBox';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {t} from 'sentry/locale';

type Props = {
  alias: string;
  data: Record<string, any>;
};

export function ReduxContext({data}: Props) {
  return (
    <ClippedBox clipHeight={250}>
      <ContextBlock
        data={[
          {
            key: 'value',
            subject: t('Latest State'),
            value: data,
          },
        ]}
      />
    </ClippedBox>
  );
}
