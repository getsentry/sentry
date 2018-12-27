import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import ConfirmHeader from 'app/views/settings/account/accountSecurity/components/confirmHeader';
import DateTime from 'app/components/dateTime';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import TextBlock from 'app/views/settings/components/text/textBlock';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Tooltip from 'app/components/tooltip';

/**
 * List u2f devices w/ ability to remove a single device
 */
class U2fEnrolledDetails extends React.Component {
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
    let {isEnrolled, devices, id, onRemoveU2fDevice} = this.props;

    if (id !== 'u2f' || !isEnrolled) return null;

    let hasDevices = devices && devices.length;
    // Note Tooltip doesn't work because of bootstrap(?) pointer events for disabled buttons
    let isLastDevice = hasDevices === 1;

    return (
      <Panel css={{marginTop: 30}}>
        <PanelHeader>{t('Device name')}</PanelHeader>

        <PanelBody>
          {!hasDevices && (
            <EmptyMessage>{t('You have not added any U2F devices')}</EmptyMessage>
          )}
          {hasDevices &&
            devices.map(device => (
              <PanelItem p={0} key={device.name}>
                <Flex p={2} pr={0} align="center" flex="1">
                  <Box flex="1">{device.name}</Box>
                  <div css={{fontSize: '0.8em', opacity: 0.6}}>
                    <DateTime date={device.timestamp} />
                  </div>
                </Flex>

                <Box p={2}>
                  <Confirm
                    onConfirm={() => onRemoveU2fDevice(device)}
                    disabled={isLastDevice}
                    message={
                      <React.Fragment>
                        <ConfirmHeader>
                          {t('Do you want to remove U2F device?')}
                        </ConfirmHeader>
                        <TextBlock>
                          {t(
                            `Are you sure you want to remove the U2F device "${device.name}"?`
                          )}
                        </TextBlock>
                      </React.Fragment>
                    }
                  >
                    <Button size="small" priority="danger">
                      <Tooltip
                        disabled={!isLastDevice}
                        title={t('Can not remove last U2F device')}
                      >
                        <span className="icon icon-trash" />
                      </Tooltip>
                    </Button>
                  </Confirm>
                </Box>
              </PanelItem>
            ))}
          <PanelItem justify="flex-end" p={2}>
            <Button type="button" to="/settings/account/security/u2f/enroll/">
              {t('Add Another Device')}
            </Button>
          </PanelItem>
        </PanelBody>
      </Panel>
    );
  }
}

export default U2fEnrolledDetails;
