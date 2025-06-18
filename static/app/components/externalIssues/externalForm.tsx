import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {ExternalIssueFormErrors} from 'sentry/components/externalIssues/utils';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {IssueConfigField} from 'sentry/types/integrations';
import type {FormField} from 'sentry/views/alerts/rules/issue/ruleNode';

interface ExternalFormProps {
  Body: ModalRenderProps['Body'];
  Header: ModalRenderProps['Header'];
  bodyText: React.ReactNode;
  formProps: FormProps;
  // XXX: Ideally this would be Partial<FieldFromConfigProps> but different field types
  // have different props. For this conversion, I'm assuming the props are correct.
  getFieldProps: (field: IssueConfigField) => Record<string, any>;
  isLoading: boolean;
  navTabs: React.ReactNode;
  title: React.ReactNode;
  errors?: ExternalIssueFormErrors;
  formFields?: IssueConfigField[];
}

export function ExternalForm({
  Header,
  Body,
  isLoading,
  formProps,
  title,
  navTabs,
  bodyText,
  formFields = [],
  errors = {},
  getFieldProps,
}: ExternalFormProps) {
  return (
    <Fragment>
      <Header closeButton>
        <h4>{title}</h4>
      </Header>
      {navTabs}
      <Body>
        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <Fragment>
            {bodyText}
            <Form {...formProps}>
              {(formFields || [])
                .filter((field: FormField) => field.hasOwnProperty('name'))
                .map(fields => ({
                  ...fields,
                  noOptionsMessage: () => t('No options. Type to search.'),
                }))
                .map((field, i) => {
                  return (
                    <Fragment key={`${field.name}-${i}`}>
                      <FieldFromConfig
                        disabled={isLoading}
                        field={field}
                        flexibleControlStateSize
                        inline={false}
                        stacked
                        {...getFieldProps(field)}
                      />
                      {errors[field.name] && errors[field.name]}
                    </Fragment>
                  );
                })}
            </Form>
          </Fragment>
        )}
      </Body>
    </Fragment>
  );
}
