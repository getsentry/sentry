import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {};

const ProjectReleaseDetails = ({}: Props) => {
  return (
    <Wrapper>
      <SectionHeading>{t('Project Release Details')}</SectionHeading>
      <StyledTable>
        <tbody>
          {[1, 2, 3, 4, 5].map((_, index) => (
            <StyledTr key={index}>
              <TagKey>Version</TagKey>
              <TagValue>04f902711</TagValue>
            </StyledTr>
          ))}
        </tbody>
      </StyledTable>
    </Wrapper>
  );
};

const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  padding-right: ${space(1)};
  line-height: 1.2;
`;

const Wrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(4)};
`;

const StyledTable = styled('table')`
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
`;

const StyledTr = styled('tr')`
  &:nth-child(2n + 1) td {
    background-color: ${p => p.theme.offWhite};
  }
`;

const TagKey = styled('td')`
  color: ${p => p.theme.gray3};
  padding: ${space(0.5)} ${space(1)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TagValue = styled(TagKey)`
  text-align: right;
  color: ${p => p.theme.blue};
  ${overflowEllipsis};
`;

export default ProjectReleaseDetails;
