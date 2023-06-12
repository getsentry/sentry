import styled from '@emotion/styled';

import ListItem from 'sentry/components/list/listItem';
import {space} from 'sentry/styles/space';

interface Props {
  children: React.ReactNode;
  title: string;
  'data-test-id'?: string;
  description?: React.ReactNode;
  required?: boolean;
}

export function BuildStep({
  title,
  description,
  required = false,
  children,
  ...props
}: Props) {
  return (
    <Wrapper {...props}>
      <Heading>
        {title}
        {required && <RequiredBadge />}
      </Heading>
      <SubHeading>{description}</SubHeading>
      <Content>{children}</Content>
    </Wrapper>
  );
}

const Wrapper = styled(ListItem)`
  display: grid;
`;

const Heading = styled('h5')`
  margin-bottom: 0;
  color: ${p => p.theme.gray500};
`;

export const SubHeading = styled('small')`
  color: ${p => p.theme.gray400};
  padding: ${space(0.25)} ${space(2)} ${space(2)} 0;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    padding-top: ${space(1)};
    margin-left: -${space(4)};
  }
`;

const Content = styled('div')`
  display: grid;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-left: -${space(4)};
  }
`;

const RequiredBadge = styled('div')`
  background: ${p => p.theme.red300};
  opacity: 0.6;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  margin-left: ${space(0.5)};
  display: inline-block;
  vertical-align: super;
`;
