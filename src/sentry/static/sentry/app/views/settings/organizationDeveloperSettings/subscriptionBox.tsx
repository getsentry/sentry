import PropTypes from 'prop-types';
import * as React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {
  DESCRIPTIONS,
  EVENT_CHOICES,
} from 'app/views/settings/organizationDeveloperSettings/constants';
import Checkbox from 'app/components/checkbox';
import Tooltip from 'app/components/tooltip';
import withOrganization from 'app/utils/withOrganization';
import SentryTypes from 'app/sentryTypes';
import {Organization} from 'app/types';

type Resource = typeof EVENT_CHOICES[number];

type DefaultProps = {
  webhookDisabled: boolean;
};

type Props = DefaultProps & {
  resource: Resource;
  disabledFromPermissions: boolean;
  checked: boolean;
  onChange: (resource: Resource, checked: boolean) => void;
  organization: Organization;
};

export class SubscriptionBox extends React.Component<Props> {
  static propTypes: any = {
    resource: PropTypes.string.isRequired,
    disabledFromPermissions: PropTypes.bool.isRequired,
    webhookDisabled: PropTypes.bool.isRequired,
    checked: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
    organization: SentryTypes.Organization,
  };

  static defaultProps: DefaultProps = {
    webhookDisabled: false,
  };

  onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const checked = evt.target.checked;
    const {resource} = this.props;
    this.props.onChange(resource, checked);
  };

  render() {
    const {resource, organization, webhookDisabled, checked} = this.props;
    const features = new Set(organization.features);

    let disabled = this.props.disabledFromPermissions || webhookDisabled;
    let message = `Must have at least 'Read' permissions enabled for ${resource}`;
    if (resource === 'error' && !features.has('integrations-event-hooks')) {
      disabled = true;
      message =
        'Your organization does not have access to the error subscription resource.';
    }
    if (webhookDisabled) {
      message = 'Cannot enable webhook subscription without specifying a webhook url';
    }

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

export default withOrganization(SubscriptionBox);

const SubscriptionInfo = styled('div')`
  display: flex;
  flex-direction: column;
`;

const SubscriptionGridItem = styled('div')<{disabled: boolean}>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background: ${p => p.theme.gray100};
  opacity: ${({disabled}: {disabled: boolean}) => (disabled ? 0.3 : 1)};
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
  color: ${p => p.theme.gray500};
  white-space: nowrap;
`;

const SubscriptionTitle = styled('div')`
  font-size: 16px;
  line-height: 1;
  color: ${p => p.theme.textColor};
  white-space: nowrap;
  margin-bottom: 5px;
`;
