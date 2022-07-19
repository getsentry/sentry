import styled from '@emotion/styled';
import classNames from 'classnames';

import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  icon: React.ReactElement;
  className?: string;
};

const Item = ({children, icon, className}: Props) => (
  <Wrapper className={classNames('context-item', className)} data-test-id="context-item">
    {icon}
    {children && <Details>{children}</Details>}
  </Wrapper>
);

export default Item;

const Details = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 100%;
  min-height: 48px;
`;

const Wrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  padding: ${space(0.5)} 0 ${space(0.5)} 40px;
  display: flex;
  align-items: center;
  position: relative;
  min-width: 0;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    :not(:last-child) {
      margin-right: ${space(3)};
    }
    max-width: 25%;
    border: 0;
    padding: 0px 0px 0px 42px;
  }
`;
