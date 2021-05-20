import styled from '@emotion/styled';

import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

type Props = {
  children: React.ReactNode;
  label: string;
  activeStep: number;
  isActive: boolean;
  height?: number;
};

function Step({children, label, activeStep, isActive, height}: Props) {
  return (
    <Wrapper activeStep={activeStep} isActive={isActive} height={height}>
      <Connector>
        <IconChevron direction="right" size="sm" isCircled />
      </Connector>
      <Content>
        {label}
        {children && <div>{children}</div>}
      </Content>
    </Wrapper>
  );
}

export default Step;

const Connector = styled('div')`
  padding: ${space(0.5)} ${space(1.5)} 0 ${space(1.5)};
`;

const getHeightStyle = (isActive: boolean, height?: number) => {
  if (!height) {
    return '';
  }

  if (isActive) {
    return `
      height: ${height}px;
    `;
  }

  return `
    height: 26px;
    :not(:last-child) {
      height: 42px;
    }
  `;
};

const Wrapper = styled('div')<{activeStep: number; isActive: boolean; height?: number}>`
  display: grid;
  grid-template-columns: max-content 1fr;
  position: relative;
  color: ${p => p.theme.gray200};
  margin-left: -${space(1.5)};

  :not(:last-child) {
    padding-bottom: ${space(2)};
    ${Connector} {
      :before {
        content: ' ';
        border-right: 1px ${p => p.theme.gray300} dashed;
        position: absolute;
        top: 28px;
        left: ${space(3)};
        height: calc(100% - 28px);
      }
    }

    :nth-child(-n + ${p => p.activeStep + 1}) {
      ${Connector} {
        :before {
          border-color: ${p => p.theme.gray500};
        }
      }
    }
  }

  :nth-child(-n + ${p => p.activeStep + 1}) {
    color: ${p => p.theme.gray500};
  }

  transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  ${p => getHeightStyle(p.isActive, p.height)}
`;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;
