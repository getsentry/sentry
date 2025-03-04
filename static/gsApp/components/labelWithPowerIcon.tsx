import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {IconBusiness} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import PowerFeatureHovercard from 'getsentry/components/powerFeatureHovercard';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {isEnterprise} from 'getsentry/utils/billing';

const SSO = 'sso';
const RELAY = 'relay';
const ALLOCATIONS = 'allocations-upsell';
const TEAM_ROLES = 'team-roles-upsell';

const TABLE_ITEMS = [TEAM_ROLES];

/**
 * This maps the IDs of the labels over to a configuration determining how the
 * tooltip should be represented.
 *
 *   {
 *     # partial indicates that this item does not strictly require a the
 *     # features to function, but will work in some way *better* with the
 *     # features. Thus "partial" support.
 *     partial: false,
 *
 *     # The list of plan features required for this functionality.
 *     features: [...]
 *   }
 */
const POWER_FEATURE_CONFIG = [
  {
    id: SSO,
    features: ['sso-saml2'],
    partial: true,
  },
  {
    id: RELAY,
    features: ['relay'],
    partial: false,
  },
  {
    id: ALLOCATIONS,
    features: ['spend-allocations'],
    partial: false,
  },
  {
    id: TEAM_ROLES,
    features: ['team-roles'],
    partial: false,
  },
];

type Props = {
  children: React.ReactNode;
  subscription: Subscription;
  id?: string;
};

function LabelWithPowerIcon({children, id, subscription}: Props) {
  // Must return React Elements
  // @see https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20544

  if (id === undefined) {
    return children as React.ReactElement;
  }

  const config = POWER_FEATURE_CONFIG.find(c => c.id === id)!;

  if (config === undefined) {
    return children as React.ReactElement;
  }

  if (!subscription || isEnterprise(subscription)) {
    return children as React.ReactElement;
  }

  const {partial, features} = config;
  const leftAligned = TABLE_ITEMS.includes(id);

  const renderDisabled = () => (
    <StyledLabel leftAligned={leftAligned}>
      {children}
      <ClassNames>
        {({css}) => (
          <PowerFeatureHovercard
            {...{id, partial, features}}
            containerClassName={css`
              display: flex;
              align-items: center;
            `}
            containerDisplayMode="inline-flex"
          >
            <IconBusiness data-test-id="power-icon" />
          </PowerFeatureHovercard>
        )}
      </ClassNames>
    </StyledLabel>
  );

  return (
    <Feature features={features} renderDisabled={renderDisabled}>
      {children}
    </Feature>
  );
}

const StyledLabel = styled('div')<{leftAligned?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: ${p => (p.leftAligned ? 'flex-start' : 'space-between')};
  width: 100%;

  > :last-child {
    margin-left: ${space(1)};
  }
`;

export default withSubscription(LabelWithPowerIcon, {noLoader: true});
