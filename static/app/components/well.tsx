import styled from '@emotion/styled';

interface WellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  centered?: boolean;
  hasImage?: boolean;
  theme?: any;
}

const Well = styled('div')<WellProps>`
  border: 1px solid ${p => p.theme.border};
  box-shadow: none;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => (p.hasImage ? '80px 30px' : '15px 20px')};
  margin-bottom: 20px;
  border-radius: 3px;
  ${p => p.centered && 'text-align: center'};
`;

export default Well;
