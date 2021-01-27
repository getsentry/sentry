import React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import Field from 'app/views/settings/components/forms/field';

import Form from './form';
import {Category} from './utils';

type Props = Form['props'];

type State = Form['state'] & {
  tracing: boolean;
};

class TransactionRuleModal extends Form<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      tracing: true,
    };
  }

  getModalTitle() {
    return t('Add a custom rule for transactions');
  }

  geTransactionFieldDescription() {
    return {
      label: t('Transaction'),
      help: t('This is a description'),
    };
  }

  getCategoryOptions() {
    return [
      [Category.RELEASES, t('Releases')],
      [Category.ENVIRONMENTS, t('Environments')],
      [Category.USERS, t('Users')],
    ] as Array<[string, string]>;
  }

  getExtraFields() {
    const {platformDocLink} = this.props;
    const {tracing} = this.state;
    return (
      <Field
        label={t('Tracing')}
        help={t('this is a description')}
        inline={false}
        flexibleControlStateSize
        stacked
        showHelpInTooltip
      >
        <TracingWrapper>
          <StyledCheckboxFancy
            onClick={() => this.handleChange('tracing', !tracing)}
            isChecked={tracing}
          />
          {platformDocLink
            ? tct(
                'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain. [link:Learn more about tracing].',
                {link: <ExternalLink href={platformDocLink} />}
              )
            : t(
                'Include all related transactions by trace ID. This can span across multiple projects. All related errors will remain.'
              )}
        </TracingWrapper>
      </Field>
    );
  }
}

export default TransactionRuleModal;

const TracingWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
`;

const StyledCheckboxFancy = styled(CheckboxFancy)`
  margin-top: ${space(0.5)};
`;
