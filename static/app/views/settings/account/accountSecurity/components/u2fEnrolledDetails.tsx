import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Input} from 'sentry/components/core/input';
import {DateTime} from 'sentry/components/dateTime';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import ConfirmHeader from 'sentry/views/settings/account/accountSecurity/components/confirmHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

function U2fEnrolledDetails(props: any) {
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
          devices?.map((device: any, i: any) => (
            <Device
              key={i}
              device={device}
              isLastDevice={isLastDevice}
              onRenameU2fDevice={onRenameU2fDevice}
              onRemoveU2fDevice={onRemoveU2fDevice}
            />
          ))}
        <AddAnotherPanelItem>
          <LinkButton to="/settings/account/security/mfa/u2f/enroll/" size="sm">
            {t('Add Another Device')}
          </LinkButton>
        </AddAnotherPanelItem>
      </PanelBody>
    </Panel>
  );
}

function Device(props: any) {
  const {device, isLastDevice, onRenameU2fDevice, onRemoveU2fDevice} = props;
  const [deviceName, setDeviceName] = useState(device.name);
  const [isEditing, setEditting] = useState(false);

  if (!isEditing) {
    return (
      <DevicePanelItem key={device.name}>
        <DeviceInformation>
          <Name>{device.name}</Name>
          <FadedDateTime date={device.timestamp} />
        </DeviceInformation>
        <Actions>
          <Button size="sm" onClick={() => setEditting(true)}>
            {t('Rename Device')}
          </Button>
        </Actions>
        <Actions>
          <Confirm
            onConfirm={() => onRemoveU2fDevice(device)}
            disabled={isLastDevice}
            message={
              <Fragment>
                <ConfirmHeader>{t('Do you want to remove U2F device?')}</ConfirmHeader>
                <TextBlock>
                  {t('Are you sure you want to remove the U2F device "%s"?', device.name)}
                </TextBlock>
              </Fragment>
            }
          >
            <Button size="sm" priority="danger">
              <Tooltip
                disabled={!isLastDevice}
                title={t('Can not remove last U2F device')}
              >
                <IconDelete size="xs" />
              </Tooltip>
            </Button>
          </Confirm>
        </Actions>
      </DevicePanelItem>
    );
  }

  return (
    <DevicePanelItem key={device.name}>
      <DeviceInformation>
        <DeviceNameInput
          type="text"
          value={deviceName}
          onChange={e => {
            setDeviceName(e.target.value);
          }}
        />
        <FadedDateTime date={device.timestamp} />
      </DeviceInformation>
      <Actions>
        <Button
          priority="primary"
          size="sm"
          onClick={() => {
            onRenameU2fDevice(device, deviceName);
            setEditting(false);
          }}
        >
          Rename Device
        </Button>
      </Actions>

      <Actions>
        <Button
          size="sm"
          title="Cancel rename"
          onClick={() => {
            setDeviceName(device.name);
            setEditting(false);
          }}
        >
          <IconClose size="xs" />
        </Button>
      </Actions>
    </DevicePanelItem>
  );
}

const DeviceNameInput = styled(Input)`
  width: 50%;
  margin-right: ${space(2)};
`;

const DevicePanelItem = styled(PanelItem)`
  padding: 0;
`;

const DeviceInformation = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1 1;
  height: 72px;

  padding: ${space(2)};
  padding-right: 0;
`;

const FadedDateTime = styled(DateTime)`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  opacity: 0.6;
`;

const Name = styled('div')`
  flex: 1;
`;

const Actions = styled('div')`
  margin: ${space(2)};
`;

const AddAnotherPanelItem = styled(PanelItem)`
  justify-content: flex-end;
  padding: ${space(2)};
`;

export default styled(U2fEnrolledDetails)`
  margin-top: ${space(4)};
`;
