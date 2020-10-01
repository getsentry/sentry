import React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconAdd, IconTelescope} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import space from 'app/styles/space';

type Props = {
  docsUrl: string;
  onOpenAddDialog: () => void;
};

const EmptyState = ({onOpenAddDialog, docsUrl}: Props) => (
  <Panel>
    <EmptyMessage
      icon={<IconTelescope size="xl" />}
      title={t('The middle layer between your app and Sentry!')}
      description={t(
        'Scrub all personally identifiable information before it arrives at Sentry. Relay improves event response time and acts as a proxy for organizations with restricted HTTP communication.'
      )}
      action={
        <Actions>
          <Button href={docsUrl} external>
            {t('Go to docs')}
          </Button>
          <Button
            priority="primary"
            icon={<IconAdd isCircled />}
            onClick={onOpenAddDialog}
          >
            {t('Register Key')}
          </Button>
        </Actions>
      }
    />
  </Panel>
);

export default EmptyState;

const Actions = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(1)};
  align-items: center;
`;
