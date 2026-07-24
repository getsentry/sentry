import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {FieldRequiredBadge} from 'sentry/components/forms/fieldGroup/fieldRequiredBadge';
import {RadioField} from 'sentry/components/forms/fields/radioField';
import {TextField} from 'sentry/components/forms/fields/textField';
import type {SuperuserAccessCategoryProps} from 'sentry/types/overrides';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

type SuperuserAccessCategories = [string, React.ReactNode];

const EngineeringCategories: SuperuserAccessCategories[] = [
  ['development', 'Development'],
  ['debugging', 'Debugging'],
  ['validate_feature', 'Validate a feature'],
];

const ReactiveSupportCategories: SuperuserAccessCategories[] = [
  ['_admin_actions', '_admin actions'],
  ['organization_setting_change', 'Change organization settings'],
  ['intercom', 'Intercom'],
];

const ProactiveSupportCategories: SuperuserAccessCategories[] = [
  ['account_review', 'Account review/research'],
  ['customer_demo', 'Customer demo'],
  ['customer_provisioning', 'Customer provisioning'],
  ['onboarding_setup', 'Onboarding setup'],
];

const OtherCategory: SuperuserAccessCategories[] = [['other', 'Other']];

const DOCUMENTATION_URL = 'https://www.notion.so/sentry/aae9a918b5814fe0918d8e7aecacf97a';

export function SuperuserAccessCategory({
  accessCategory,
  accessCategoryError,
  onAccessCategoryChange,
  onReasonChange,
  reason,
  reasonError,
}: SuperuserAccessCategoryProps) {
  return (
    <Fragment>
      <Alert variant="muted" showIcon={false}>
        For more information on these categories, please{' '}
        <ExternalLink href={DOCUMENTATION_URL}>see this Notion document</ExternalLink>.
      </Alert>
      <CategoriesLabel>
        Categories of Superuser Access
        <FieldRequiredBadge />
      </CategoriesLabel>
      <CategoryGrid>
        <RadioField
          name="superuserAccessCategory"
          inline={false}
          label="Engineering"
          choices={EngineeringCategories}
          onChange={onAccessCategoryChange}
          value={accessCategory}
          stacked
        />
        <RadioField
          name="superuserAccessCategory"
          inline={false}
          label="Reactive Support"
          choices={ReactiveSupportCategories}
          onChange={onAccessCategoryChange}
          value={accessCategory}
          stacked
        />
        <RadioField
          name="superuserAccessCategory"
          inline={false}
          label="Proactive Support"
          choices={ProactiveSupportCategories}
          onChange={onAccessCategoryChange}
          value={accessCategory}
          stacked
        />
        <RadioField
          name="superuserAccessCategory"
          inline={false}
          label="Others"
          choices={OtherCategory}
          onChange={onAccessCategoryChange}
          value={accessCategory}
          stacked
        />
      </CategoryGrid>
      {accessCategoryError ? (
        <Text role="alert" size="sm" variant="danger">
          {accessCategoryError}
        </Text>
      ) : null}
      <TextField
        name="superuserReason"
        label="Reason for Access"
        inline={false}
        stacked
        flexibleControlStateSize
        required
        maxLength={128}
        minLength={4}
        onChange={onReasonChange}
        placeholder="e.g. disabling SSO enforcement"
        value={reason}
      />
      {reasonError ? (
        <Text role="alert" size="sm" variant="danger">
          {reasonError}
        </Text>
      ) : null}
    </Fragment>
  );
}

const CategoriesLabel = styled(TextBlock)`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;

const CategoryGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;
