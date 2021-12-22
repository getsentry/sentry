import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/actions/button';
import space from 'sentry/styles/space';

type Props = {
  buttonText: string;
  formProps?: Omit<React.HTMLProps<HTMLFormElement>, 'as'>;
  formFields?: Array<{name: string; value: any}>;
} & Partial<Pick<React.ComponentProps<typeof Button>, 'disabled' | 'onClick' | 'href'>>;

export default function FooterWithButtons({
  buttonText,
  formFields,
  formProps,
  ...rest
}: Props) {
  // Since this is form we submit with, we may need to pass a hidden replica of the form inputs
  // so we can submit those
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
