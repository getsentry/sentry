import styled from '@emotion/styled';

import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import {Body, Main, Side} from 'app/components/layouts/thirds';
import QuestionTooltip from 'app/components/questionTooltip';
import SidebarSection from 'app/components/sidebarSection';
import Tag from 'app/components/tag';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

export default {
  title: 'Views/Sidebar Section',
};

export const Default = () => (
  <Body>
    <Main />
    <Side>
      <Container>
        <SidebarSection title="Left Group">{'16 hours'}</SidebarSection>
        <SidebarSection title="Right Group">{'16 hours'}</SidebarSection>
      </Container>
      <SidebarSection title="Subheading">{'16 hours'}</SidebarSection>
      <SidebarSection
        title="Icon, Tag, and Text"
        icon={<QuestionTooltip position="top" title="Tooltip description" size="sm" />}
      >
        <div>
          <Tooltip title="Tooltip description" isHoverable>
            <Tag type="default">{'Adopted'}</Tag>
          </Tooltip>
          <Environment>{'in production'}</Environment>
        </div>
      </SidebarSection>
      <SidebarSection title="With Rows">
        <KeyValueTable>
          <KeyValueTableRow
            keyName="Created"
            value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
          />
          <KeyValueTableRow
            keyName="Version"
            value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
          />
          <KeyValueTableRow
            keyName="Package"
            value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
          />
          <KeyValueTableRow
            keyName="First Event"
            value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
          />
          <KeyValueTableRow
            keyName="Last Event"
            value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
          />
          <KeyValueTableRow
            keyName="Source Maps"
            value={<StyledTextOverflow>{'\u2014'}</StyledTextOverflow>}
          />
        </KeyValueTable>
      </SidebarSection>
    </Side>
  </Body>
);

Default.storyName = 'Sidebar Section';
Default.parameters = {
  docs: {
    description: {
      story: 'Section of the sidebar.',
    },
  },
};

const Container = styled('div')`
  display: grid;
  grid-template-columns: 50% 50%;
  grid-row-gap: ${space(2)};
`;

const Environment = styled('span')`
  color: ${p => p.theme.textColor};
  margin-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledTextOverflow = styled(TextOverflow)`
  line-height: inherit;
  text-align: right;
`;
