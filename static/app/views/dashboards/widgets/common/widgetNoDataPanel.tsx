import {EmptyState} from '@sentry/scraps/emptyState';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function WidgetNoDataPanel() {
  return (
    <EmptyState
      title={<CenteredText>{t('No data to plot.')}</CenteredText>}
      description={<CenteredText>{t('Try adjusting the filters.')}</CenteredText>}
    />
  );
}

function CenteredText({children}: {children: React.ReactNode}) {
  return (
    <Text display="block" align="center" variant="inherit">
      {children}
    </Text>
  );
}
