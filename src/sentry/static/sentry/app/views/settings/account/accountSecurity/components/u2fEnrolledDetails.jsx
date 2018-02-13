import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../../../../locale';
import Button from '../../../../../components/buttons/button';
import Confirm from '../../../../../components/confirm';
import ConfirmHeader from './confirmHeader';
import DateTime from '../../../../../components/dateTime';
import Panel from '../../../components/panel';
import PanelBody from '../../../components/panelBody';
import PanelHeader from '../../../components/panelHeader';
import PanelItem from '../../../components/panelItem';
import TextBlock from '../../../components/text/textBlock';
import EmptyMessage from '../../../components/emptyMessage';

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

    return (
      <Panel css={{marginTop: 30}}>
        <PanelHeader>{t('Device name')}</PanelHeader>

        <PanelBody>
          {!hasDevices && (
            <EmptyMessage>{t('You have not added any u2f devices')}</EmptyMessage>
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
                    onConfirm={onRemoveU2fDevice}
                    message={
                      <React.Fragment>
                        <ConfirmHeader>
                          {t('Do you want to remove u2f device?')}
                        </ConfirmHeader>
                        <TextBlock>
                          {t(
                            `Are you sure you want to remove the u2f device "${device.name}"?`
                          )}
                        </TextBlock>
                      </React.Fragment>
                    }
                  >
                    <Button size="small" priority="danger">
                      <span className="icon icon-trash" />
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
