import {Fragment} from 'react';
import styled from '@emotion/styled';

import {FieldRequiredBadge} from 'sentry/components/forms/fieldGroup/fieldRequiredBadge';
import RadioField from 'sentry/components/forms/fields/radioField';
import TextField from 'sentry/components/forms/fields/textField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const StyledRadioField = styled(RadioField)`
  display: flex;
  padding-left: 0;
  flex-direction: column;
`;

const StyledTextField = styled(TextField)`
  padding-left: 0;
`;

const StyledTextBlock = styled(TextBlock)`
  margin-bottom: ${space(1)};
`;

const StyledTitleBlock = styled(TextBlock)`
  font-size: 18px;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const FlexBox = styled('div')`
  display: flex;
`;
const Left = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Right = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Span = styled('span')`
  font-size: 18px;
`;

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

function SuperuserAccessCategory() {
  return (
    <Fragment>
      <StyledTextBlock>
        For more information on these categories, please{' '}
        <a href="https://www.notion.so/sentry/Superuser-Access-Documentation-aae9a918b5814fe0918d8e7aecacf97a">
          {' '}
          read this doc
        </a>
        .
      </StyledTextBlock>
      <StyledTitleBlock>
        {t('Categories of Superuser Access:')}
        <FieldRequiredBadge />
      </StyledTitleBlock>
      <FlexBox>
        <Left>
          <StyledRadioField
            name="superuserAccessCategory"
            inline={false}
            label={t('Engineering')}
            choices={EngineeringCategories}
            stacked
          />
          <StyledRadioField
            name="superuserAccessCategory"
            inline={false}
            label={t('Reactive Support')}
            choices={ReactiveSupportCategories}
            stacked
          />
        </Left>
        <Right>
          <StyledRadioField
            name="superuserAccessCategory"
            inline={false}
            label={t('Proactive Support')}
            choices={ProactiveSupportCategories}
            stacked
          />
          <StyledRadioField
            name="superuserAccessCategory"
            inline={false}
            label={t('Others')}
            choices={OtherCategory}
            stacked
          />
        </Right>
      </FlexBox>
      <StyledTextField
        inline={false}
        label={<Span>{t('Reason for Access:')}</Span>}
        name="superuserReason"
        flexibleControlStateSize
        required
        maxLength={128}
        minLength={4}
        placeholder="e.g. disabling SSO enforcement"
      />
    </Fragment>
  );
}

export default SuperuserAccessCategory;
