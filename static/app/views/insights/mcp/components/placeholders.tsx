import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

const PlaceholderContent = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

function PlaceholderText() {
  return <PlaceholderContent>{t('Placeholder')}</PlaceholderContent>;
}

export function RequestsBySourceWidget() {
  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Requests by source')} />}
      Visualization={<PlaceholderText />}
    />
  );
}
