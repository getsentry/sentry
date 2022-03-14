import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/actions/button';
import {ButtonProps} from 'sentry/components/button';
import space from 'sentry/styles/space';

interface FooterWithButtonsProps
  extends Partial<Pick<ButtonProps, 'disabled' | 'onClick' | 'href'>> {
  buttonText: string;
  formFields?: Array<{name: string; value: any}>;
  formProps?: Omit<React.HTMLProps<HTMLFormElement>, 'as'>;
}

export default function FooterWithButtons({
  buttonText,
  formFields,
  formProps,
  ...rest
}: FooterWithButtonsProps) {
  /**
   * We use a form post here to replicate what we do with standard HTML views for the integration pipeline.
   * Since this is a form post, we need to pass a hidden replica of the form inputs
   * so we can submit this form instead of the one collecting the user inputs.
   */
  return (
    <Footer data-test-id="aws-lambda-footer-form" {...formProps}>
      {formFields?.map(field => {
        return <input type="hidden" key={field.name} {...field} />;
      })}
      <Button priority="primary" type="submit" size="xsmall" {...rest}>
        {buttonText}
      </Button>
    </Footer>
  );
}

// wrap in form so we can keep form submission behavior
const Footer = styled('form')`
  width: 100%;
  position: fixed;
  display: flex;
  justify-content: flex-end;
  bottom: 0;
  z-index: 100;
  background-color: ${p => p.theme.bodyBackground};
  border-top: 1px solid ${p => p.theme.innerBorder};
  padding: ${space(2)};
`;
