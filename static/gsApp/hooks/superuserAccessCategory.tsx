import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {FieldRequiredBadge} from 'sentry/components/forms/fieldGroup/fieldRequiredBadge';
import RadioField from 'sentry/components/forms/fields/radioField';
import TextField from 'sentry/components/forms/fields/textField';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type SuperuserAccessCategories = [string, React.ReactNode];

const EngineeringCategories: SuperuserAccessCategories[] = [
  ['development', 'Development'],
  ['debugging', 'Debugging'],
  ['validate_feature', 'Validate a feature'],
];

const ReactiveSupportCategories: SuperuserAccessCategories[] = [
  ['_admin_actions', '_admin actions'],
  ['organization_setting_change', 'Change organization settings'],
  ['zendesk', 'Zendesk'],
];

const ProactiveSupportCategories: SuperuserAccessCategories[] = [
  ['account_review', 'Account review/research'],
  ['customer_demo', 'Customer demo'],
  ['customer_provisioning', 'Customer provisioning'],
  ['onboarding_setup', 'Onboarding setup'],
];

const OtherCategory: SuperuserAccessCategories[] = [['other', 'Other']];

const DOCUMENTATION_URL = 'https://www.notion.so/sentry/aae9a918b5814fe0918d8e7aecacf97a';

function SuperuserAccessCategory() {
  return (
    <Fragment>
      <Alert variant="subtle" showIcon={false}>
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
          stacked
        />
        <RadioField
          name="superuserAccessCategory"
          inline={false}
          label="Reactive Support"
          choices={ReactiveSupportCategories}
          stacked
        />
        <RadioField
          name="superuserAccessCategory"
          inline={false}
          label="Proactive Support"
          choices={ProactiveSupportCategories}
          stacked
        />
        <RadioField
          name="superuserAccessCategory"
          inline={false}
          label="Others"
          choices={OtherCategory}
          stacked
        />
      </CategoryGrid>
      <TextField
        name="superuserReason"
        label="Reason for Access"
        inline={false}
        stacked
        flexibleControlStateSize
        required
        maxLength={128}
        minLength={4}
        placeholder="e.g. disabling SSO enforcement"
      />
    </Fragment>
  );
}

const CategoriesLabel = styled(TextBlock)`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const CategoryGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

export default SuperuserAccessCategory;
