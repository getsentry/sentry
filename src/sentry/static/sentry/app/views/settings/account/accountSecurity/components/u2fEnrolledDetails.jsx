import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import ConfirmHeader from 'app/views/settings/account/accountSecurity/components/confirmHeader';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Tooltip from 'app/components/tooltip';
import {IconDelete} from 'app/icons';
import space from 'app/styles/space';

/**
 * List u2f devices w/ ability to remove a single device
 */
class U2fEnrolledDetails extends Component {
  static propTypes = {
    isEnrolled: PropTypes.bool,
    id: PropTypes.string,
    devices: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        timestamp: PropTypes.any,
      })
    ),
    onRemoveU2fDevice: PropTypes.func.isRequired,
  };

  render() {
    const {className, isEnrolled, devices, id, onRemoveU2fDevice} = this.props;

    if (id !== 'u2f' || !isEnrolled) {
      return null;
    }

    const hasDevices = devices && devices.length;
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
            devices.map(device => (
              <DevicePanelItem key={device.name}>
                <DeviceInformation>
                  <Name>{device.name}</Name>
                  <FadedDateTime date={device.timestamp} />
                </DeviceInformation>

                <Actions>
                  <Confirm
                    onConfirm={() => onRemoveU2fDevice(device)}
                    disabled={isLastDevice}
                    message={
                      <Fragment>
                        <ConfirmHeader>
                          {t('Do you want to remove U2F device?')}
                        </ConfirmHeader>
                        <TextBlock>
                          {t(
                            `Are you sure you want to remove the U2F device "${device.name}"?`
                          )}
                        </TextBlock>
                      </Fragment>
                    }
                  >
                    <Button size="small" priority="danger">
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
            ))}
          <AddAnotherPanelItem>
            <Button
              type="button"
              to="/settings/account/security/mfa/u2f/enroll/"
              size="small"
            >
              {t('Add Another Device')}
            </Button>
          </AddAnotherPanelItem>
        </PanelBody>
      </Panel>
    );
  }
}

const DevicePanelItem = styled(PanelItem)`
  padding: 0;
`;

const DeviceInformation = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;

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
