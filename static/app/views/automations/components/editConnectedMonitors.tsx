import type {Dispatch, SetStateAction} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';

interface Props {
  connectedIds: Set<string>;
  setConnectedIds: Dispatch<SetStateAction<Set<string>>>;
}

export default function EditConnectedMonitors({connectedIds, setConnectedIds}: Props) {
  return (
    <div>
      {connectedIds.size > 0 && (
        <Fragment>
          <Heading>{t('Connected Monitors')}</Heading>
          <ConnectedMonitorsList
            detectorIds={Array.from(connectedIds)}
            connectedDetectorIds={connectedIds}
            setConnectedDetectorIds={setConnectedIds}
          />
        </Fragment>
      )}
      <Heading>
        {/* TODO: Filter out connected monitors */}
        {t('All Monitors')}
      </Heading>
      <div style={{flexGrow: 1}}>
        <StyledInputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch color="subText" size="sm" />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            placeholder={t('Search for a monitor or project')}
            type="text"
            autoComplete="off"
          />
        </StyledInputGroup>
      </div>
      <ConnectedMonitorsList
        detectorIds={undefined}
        connectedDetectorIds={connectedIds}
        setConnectedDetectorIds={setConnectedIds}
      />
    </div>
  );
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(1.5)};
`;

const StyledInputGroup = styled(InputGroup)`
  margin-bottom: ${space(2)};
`;
