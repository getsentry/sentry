import {useState} from 'react';
import styled from '@emotion/styled';

import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Input} from 'sentry/components/core/input';
import {DateTime} from 'sentry/components/dateTime';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconClose, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AuthenticatorDevice} from 'sentry/types/auth';

interface U2fEnrolledDetailsProps {
  devices: AuthenticatorDevice[];
  id: string;
  isEnrolled: boolean;
  onRemoveU2fDevice: (device: AuthenticatorDevice) => void;
  onRenameU2fDevice: (device: AuthenticatorDevice, deviceName: string) => void;
  className?: string;
}

function U2fEnrolledDetails(props: U2fEnrolledDetailsProps) {
  const {className, isEnrolled, devices, id, onRemoveU2fDevice, onRenameU2fDevice} =
    props;

  if (id !== 'u2f' || !isEnrolled) {
    return null;
  }

  const hasDevices = devices?.length;
  // Note Tooltip doesn't work because of bootstrap(?) pointer events for disabled buttons
  const isLastDevice = hasDevices === 1;
  return (
    <Panel className={className}>
      <PanelHeader>{t('Device name')}</PanelHeader>

      <PanelBody>
        {!hasDevices && (
          <EmptyMessage>{t('You have not added any U2F devices')}</EmptyMessage>
        )}
        {hasDevices &&
          devices?.map((device, i) => (
            <Device
              key={i}
              device={device}
              isLastDevice={isLastDevice}
              onRenameU2fDevice={onRenameU2fDevice}
              onRemoveU2fDevice={onRemoveU2fDevice}
            />
          ))}
      </PanelBody>
      <AddAnotherFooter>
        <LinkButton to="/settings/account/security/mfa/u2f/enroll/" size="sm">
          {t('Add Another Device')}
        </LinkButton>
      </AddAnotherFooter>
    </Panel>
  );
}

interface DeviceProps {
  device: AuthenticatorDevice;
  isLastDevice: boolean;
  onRemoveU2fDevice: (device: AuthenticatorDevice) => void;
  onRenameU2fDevice: (device: AuthenticatorDevice, deviceName: string) => void;
}

function Device(props: DeviceProps) {
  const {device, isLastDevice, onRenameU2fDevice, onRemoveU2fDevice} = props;
  const [deviceName, setDeviceName] = useState(device.name);
  const [isEditing, setEditting] = useState(false);

  if (!isEditing) {
    return (
      <PanelItem key={device.name}>
        <DeviceInformation>
          {device.name}
          <FadedDateTime date={device.timestamp} />
        </DeviceInformation>
        <ButtonBar>
          <Button size="sm" onClick={() => setEditting(true)}>
            {t('Rename device')}
          </Button>
          <Confirm
            onConfirm={() => onRemoveU2fDevice(device)}
            disabled={isLastDevice}
            message={t('Are you sure you want to remove the device "%s"?', device.name)}
          >
            <Button
              aria-label={t('Remove device')}
              size="sm"
              priority="danger"
              icon={<IconDelete />}
              title={isLastDevice ? t('Can not remove last U2F device') : undefined}
            />
          </Confirm>
        </ButtonBar>
      </PanelItem>
    );
  }

  return (
    <PanelItem key={device.name}>
      <DeviceInformation>
        <DeviceNameInput
          size="sm"
          type="text"
          value={deviceName}
          onChange={e => {
            setDeviceName(e.target.value);
          }}
        />
        <FadedDateTime date={device.timestamp} />
      </DeviceInformation>
      <ButtonBar>
        <Button
          priority="primary"
          size="sm"
          onClick={() => {
            onRenameU2fDevice(device, deviceName);
            setEditting(false);
          }}
        >
          {t('Rename device')}
        </Button>
        <Button
          size="sm"
          title={t('Cancel Rename')}
          aria-label={t('Cancel Rename')}
          icon={<IconClose />}
          onClick={() => {
            setDeviceName(device.name);
            setEditting(false);
          }}
        />
      </ButtonBar>
    </PanelItem>
  );
}

const DeviceNameInput = styled(Input)`
  width: 50%;
  margin-right: ${space(2)};
`;

const DeviceInformation = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1 1;
  gap: ${space(1)};
  margin-right: ${space(1)};
`;

const FadedDateTime = styled(DateTime)`
  font-size: ${p => p.theme.fontSize.sm};
  opacity: 0.6;
`;

const AddAnotherFooter = styled(PanelFooter)`
  display: flex;
  justify-content: flex-end;
  padding: ${space(2)};
`;

export default styled(U2fEnrolledDetails)`
  margin-top: ${space(4)};
`;
