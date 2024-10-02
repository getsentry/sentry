import styled from '@emotion/styled';

import type {ButtonProps} from 'sentry/components/button';
import {Button, LinkButton} from 'sentry/components/button';
import {space} from 'sentry/styles/space';

interface FooterWithButtonsProps {
  buttonText: string;
  disabled?: boolean;
  formFields?: Array<{name: string; value: any}>;
  formProps?: React.FormHTMLAttributes<HTMLFormElement>;
  href?: string;
  onClick?: ButtonProps['onClick'];
}

export default function FooterWithButtons({
  buttonText,
  disabled,
  formFields,
  formProps,
  href,
  onClick,
}: FooterWithButtonsProps) {
  const buttonProps = {
    priority: 'primary',
    disabled,
    onClick,
    children: buttonText,
  } satisfies Partial<ButtonProps>;

  const button =
    href !== undefined ? (
      <LinkButton href={href} {...buttonProps} />
    ) : (
      <Button type="submit" {...buttonProps} />
    );

  // We use a form post here to replicate what we do with standard HTML views
  // for the integration pipeline. Since this is a form post, we need to pass a
  // hidden replica of the form inputs so we can submit this form instead of
  // the one collecting the user inputs.
  return (
    <Footer data-test-id="aws-lambda-footer-form" {...formProps}>
      {formFields?.map(field => <input type="hidden" key={field.name} {...field} />)}
      {button}
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
