import {Alert} from '@sentry/scraps/alert';
import {Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {SuperuserAccessCategoryProps} from 'sentry/types/overrides';

type SuperuserAccessCategory = [value: string, label: React.ReactNode];

const ENGINEERING_CATEGORIES: SuperuserAccessCategory[] = [
  ['development', 'Development'],
  ['debugging', 'Debugging'],
  ['validate_feature', 'Validate a feature'],
];

const REACTIVE_SUPPORT_CATEGORIES: SuperuserAccessCategory[] = [
  ['_admin_actions', '_admin actions'],
  ['organization_setting_change', 'Change organization settings'],
  ['intercom', 'Intercom'],
];

const PROACTIVE_SUPPORT_CATEGORIES: SuperuserAccessCategory[] = [
  ['account_review', 'Account review/research'],
  ['customer_demo', 'Customer demo'],
  ['customer_provisioning', 'Customer provisioning'],
  ['onboarding_setup', 'Onboarding setup'],
];

const OTHER_CATEGORIES: SuperuserAccessCategory[] = [['other', 'Other']];

const ACCESS_CATEGORY_GROUPS = [
  {label: 'Engineering', options: ENGINEERING_CATEGORIES},
  {label: 'Reactive Support', options: REACTIVE_SUPPORT_CATEGORIES},
  {label: 'Proactive Support', options: PROACTIVE_SUPPORT_CATEGORIES},
  {label: 'Others', options: OTHER_CATEGORIES},
];

const DOCUMENTATION_URL = 'https://www.notion.so/sentry/aae9a918b5814fe0918d8e7aecacf97a';

export function SuperuserAccessCategory({RadioItem}: SuperuserAccessCategoryProps) {
  return (
    <Stack gap="xl" flexGrow={1}>
      <Alert variant="muted" showIcon={false}>
        For more information on these categories, please{' '}
        <ExternalLink href={DOCUMENTATION_URL}>see this Notion document</ExternalLink>.
      </Alert>
      <Grid columns="repeat(2, minmax(0, 1fr))" gap="xl 2xl">
        {ACCESS_CATEGORY_GROUPS.map(group => (
          <Stack gap="md" key={group.label}>
            <Text bold>{group.label}</Text>
            <Stack gap="md">
              {group.options.map(([value, label]) => (
                <RadioItem value={value} key={value}>
                  {label}
                </RadioItem>
              ))}
            </Stack>
          </Stack>
        ))}
      </Grid>
    </Stack>
  );
}
