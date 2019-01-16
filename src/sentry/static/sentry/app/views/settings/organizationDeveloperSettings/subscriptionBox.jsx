import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import {DESCRIPTIONS} from 'app/views/settings/organizationDeveloperSettings/constants';
import styled from 'react-emotion';
import Checkbox from 'app/components/checkbox';
import Tooltip from 'app/components/tooltip';
import {Flex} from 'grid-emotion';

export default class SubscriptionBox extends React.Component {
  static propTypes = {
    resource: PropTypes.string.isRequired,
    disabled: PropTypes.bool.isRequired,
    checked: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      checked: this.props.checked,
    };
  }

  onChange = evt => {
    let checked = evt.target.checked;
    const {resource} = this.props;
    this.setState({checked});
    this.props.onChange(resource, checked);
  };

  render() {
    const {resource, disabled} = this.props;
    const {checked} = this.state;
    const message = `Must have at least 'Read' permissions enabled for ${resource}`;
    return (
      <React.Fragment>
        <SubscriptionGridItemWrapper key={resource}>
          <Tooltip disabled={!disabled} title={message}>
            <SubscriptionGridItem disabled={disabled}>
              <SubscriptionInfo>
                <SubscriptionTitle>{t(`${resource}`)}</SubscriptionTitle>
                <SubscriptionDescription>
                  {t(`${DESCRIPTIONS[resource]}`)}
                </SubscriptionDescription>
              </SubscriptionInfo>
              <Checkbox
                key={`${resource}${checked}`}
                disabled={disabled}
                id={resource}
                value={resource}
                checked={checked}
                onChange={this.onChange}
              />
            </SubscriptionGridItem>
          </Tooltip>
        </SubscriptionGridItemWrapper>
      </React.Fragment>
    );
  }
}

const SubscriptionInfo = styled(Flex)`
  flex-direction: column;
`;

const SubscriptionGridItem = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background: ${p => p.theme.whiteDark};
  opacity: ${p => (p.disabled ? 0.3 : 1)};
  border-radius: 3px;
  flex: 1;
  padding: 12px;
  height: 100%;
`;

const SubscriptionGridItemWrapper = styled('div')`
  padding: 12px;
  width: 33%;
`;

const SubscriptionDescription = styled('div')`
  font-size: 12px;
  line-height: 1;
  color: ${p => p.theme.gray2};
  white-space: nowrap;
`;

const SubscriptionTitle = styled('div')`
  font-size: 16px;
  line-height: 1;
  color: ${p => p.theme.textColor};
  white-space: nowrap;
  margin-bottom: 5px;
`;
