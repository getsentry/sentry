import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

interface Props {
  initialIds: Set<string>;
  onSave: (ids: Set<string>) => void;
}

export function EditConnectedMonitorsDrawer({initialIds, onSave}: Props) {
  const organization = useOrganization();
  const [connectedIds, setConnectedIds] = useState<Set<string>>(initialIds);

  return (
    <DrawerWrapper>
      <DrawerHeader />
      <StyledDrawerBody>
        <EditConnectedMonitors
          connectedIds={connectedIds}
          setConnectedIds={setConnectedIds}
        />
      </StyledDrawerBody>
      <StickyFooter>
        <Flex justify="space-between" flex={1}>
          <LinkButton
            icon={<IconAdd redesign redesign />}
            to={`${makeMonitorBasePathname(organization.slug)}new/`}
          >
            {t('Create New Monitor')}
          </LinkButton>
          <Button priority="primary" redesign onClick={() => onSave(connectedIds)}>
            {t('Save')}
          </Button>
        </Flex>
      </StickyFooter>
    </DrawerWrapper>
  );
}

const DrawerWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const StyledDrawerBody = styled(DrawerBody)`
  flex: 1;
  overflow: auto;
`;
