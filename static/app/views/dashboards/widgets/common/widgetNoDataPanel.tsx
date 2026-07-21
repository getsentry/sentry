import {Flex} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';

export function WidgetNoDataPanel() {
  return (
    <Flex position="absolute" inset={0} align="center" justify="center">
      <EmptyMessage title={t('No data to plot')}>
        {t('Try adjusting the filters.')}
      </EmptyMessage>
    </Flex>
  );
}
