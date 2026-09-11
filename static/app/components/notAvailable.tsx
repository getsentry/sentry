import styled from '@emotion/styled';

type Props = {
  className?: string;
};

export function NotAvailable({className}: Props) {
  return <Wrapper className={className}>{'\u2014'}</Wrapper>;
}

const Wrapper = styled('div')`
  color: ${p => p.theme.colors.gray200};
`;
