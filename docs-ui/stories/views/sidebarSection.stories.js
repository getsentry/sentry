import styled from '@emotion/styled';

import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import QuestionTooltip from 'app/components/questionTooltip';
import SidebarSection from 'app/components/sidebarSection';
import Tag from 'app/components/tag';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

export default {
  title: 'Views/Sidebar Section',
  component: SidebarSection,
};

export const Default = () => (
  <SidebarSection title="Subheading">{'16 hours'}</SidebarSection>
);

Default.storyName = 'With text';
Default.parameters = {
  docs: {
    description: {
      story: 'Generic sidebar section with text.',
    },
  },
};

export const WithIconTagsText = () => (
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
);

WithIconTagsText.storyName = 'With Icon, Tags, and Text';
WithIconTagsText.parameters = {
  docs: {
    description: {
      story: 'Sidebar section that has an icon, tag, and text.',
    },
  },
};

export const WithRows = () => (
  <SidebarSection title="With Multiple Rows">
    <KeyValueTable>
      <KeyValueTableRow
        keyName="Created"
        value={<StyledTextOverflow>{'Nov 17, 2021 5:36 PM'}</StyledTextOverflow>}
      />
      <KeyValueTableRow
        keyName="Version"
        value={<StyledTextOverflow>{'3.3.3'}</StyledTextOverflow>}
      />
      <KeyValueTableRow
        keyName="Package"
        value={<StyledTextOverflow>{'frontend'}</StyledTextOverflow>}
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
        value={<StyledTextOverflow>{'333 artifacts'}</StyledTextOverflow>}
      />
    </KeyValueTable>
  </SidebarSection>
);

WithRows.storyName = 'With Multiple Rows';
WithRows.parameters = {
  docs: {
    description: {
      story:
        'Section of the sidebar with multiple rows using the KeyValueTable component (label with date, etc).',
    },
  },
};

const Environment = styled('span')`
  color: ${p => p.theme.textColor};
  margin-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledTextOverflow = styled(TextOverflow)`
  line-height: inherit;
  text-align: right;
`;
