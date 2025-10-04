import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';

import {space} from 'sentry/styles/space';

import {LayoutGap} from '../layout';

export default function CommitYamlPage() {
  return (
    <LayoutGap>
      <EmptyStateWarning>
        <p>{t('Commit YAML configuration')}</p>
      </EmptyStateWarning>
    </LayoutGap>
  );
}
