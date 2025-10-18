import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function CommitYamlPage() {
  return (
    <LayoutGap>
      <EmptyStateWarning>
        <Text as="p">{t('Commit YAML configuration')}</Text>
      </EmptyStateWarning>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
